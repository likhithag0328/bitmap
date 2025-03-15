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

  async processImg(type, value) {
    this.#image = (await Deno.open(this.#inputFile)).readable;
    this.#output = await Deno.open(this.#outputFile, {
      create: true,
      write: true,
    });

    const transform = new TransformStream({
      transform: (chunk, controller) => {
        if (this.#isFirst) {
          this.#readHeaderAndPixelData(chunk);
        } else {
          this.#pixelData.push(...chunk);
        }

        const pixels = this.#processPixels(type, value);
        controller.enqueue(new Uint8Array([...this.#meta, ...pixels]));
        this.#clear();
      },
    });

    this.#image.pipeThrough(transform).pipeTo(this.#output.writable);
  }

  #readHeaderAndPixelData(chunk) {
    this.#meta.push(...chunk.slice(0, 54));
    this.#pixelData.push(...chunk.slice(54));
    this.#isFirst = false;
  }

  #clear() {
    this.#meta = [];
    this.#pixelData = [];
  }

  #adjust = {
    brightness(pixel, value) {
      const adjustedPixel = pixel + value;
      return Math.max(0, Math.min(255, adjustedPixel));
    },
  };

  #processPixels(type, value) {
    if (!this.#adjust[type]) {
      throw new Error(`Unknown adjustment type: ${type}`);
    }

    const pixels = [];
    this.#pixelData.forEach((pixel) => {
      const adjustedPixel = pixel === 0 ? 0 : this.#adjust[type](pixel, value);
      pixels.push(adjustedPixel);
    });
    return pixels;
  }
}

const processor = new Adjust(Deno.args[0], Deno.args[1]);
const type = Deno.args[2] || "brightness";
const value = parseInt(Deno.args[3]) || 0;
await processor.processImg(type, value);
