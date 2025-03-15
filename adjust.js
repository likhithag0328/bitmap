class Adjust {
  #inputFile;
  #outputFile;
  #image;
  #output;
  #isFirst;
  #meta;
  #pixelData;

  constructor(inputFile, outputFile) {
    this.#inputFile = inputFile;
    this.#outputFile = outputFile;
    this.#isFirst = true;
    this.#meta = [];
    this.#pixelData = [];
  }

  async processImg() {
    this.#image = (await Deno.open(this.#inputFile)).readable;
    this.#output = await Deno.open(this.#outputFile, {
      create: true,
      write: true,
    });

    const transform = new TransformStream({
      transform: (chunk, controller) => {
        if (this.#isFirst) {
          this.readHeaderAndPixelData(chunk);
        } else {
          this.#pixelData.push(...chunk);
        }

        const pixels = this.processPixels();
        controller.enqueue(new Uint8Array([...this.#meta, ...pixels]));
        this.clear();
      },
    });

    this.#image.pipeThrough(transform).pipeTo(this.#output.writable);
  }

  readHeaderAndPixelData(chunk) {
    this.#meta.push(...chunk.slice(0, 54));
    this.#pixelData.push(...chunk.slice(54));
    this.#isFirst = false;
  }

  clear() {
    this.#meta = [];
    this.#pixelData = [];
  }

  processPixels() {
    const pixels = [];
    this.#pixelData.forEach((pixel) => {
      const adjustedPixel = pixel === 0 ? 0 : Math.abs(pixel - 100);
      pixels.push(adjustedPixel);
    });
    return pixels;
  }
}
const processor = new Adjust(Deno.args[0], Deno.args[1]);
await processor.processImg();
