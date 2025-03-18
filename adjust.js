class ImgProcessor {
  constructor(inputFile, outputFile) {
    this.inputFile = inputFile;
    this.outputFile = outputFile;
    this.meta = {};
  }

  async openFiles() {
    this.imgStream = await Deno.open(this.inputFile);
    this.output = await Deno.open(this.outputFile, {
      create: true,
      write: true,
    });

    this.writer = this.output.writable.getWriter();
  }

  closeFiles() {
    if (this.imgStream) this.imgStream.close();
    if (this.output) this.output.close();
  }

  async redirectBmpHeader() {
    const buffer = new Uint8Array(14);
    await this.imgStream.read(buffer);

    this.meta.bmp = buffer;
    await this.writer.write(this.meta.bmp);
  }

  read4Bytes(chunk, start) {
    return new DataView(chunk.buffer).getInt32(start, true);
  }

  adjust = {
    brightness: (components, factor) =>
      components.map((c) => Math.max(0, Math.min(255, c + factor))),

    contrast: (components, value) =>
      components.map((c) => {
        const changed = 128 + (c - 128) * (1 + value / 100);
        return Math.max(0, Math.min(255, changed));
      }),

    "black-and-white": (bgr) => {
      const [b, g, r] = bgr;
      const grayValue = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      return [grayValue, grayValue, grayValue];
    },

    negative: (components) => components.map((c) => 255 - c),

    saturation: (triplet, factor) => {
      const avg = triplet.reduce((a, b) => a + b, 0) / 3;
      return triplet.map((value) => {
        if (factor === 0) return value;

        const adjustedValue = avg + (value - avg) * Math.exp(factor / 10);

        return Math.round(adjustedValue);
      }).map((v) => Math.max(0, Math.min(255, v)));
    },
  };

  async redirectPixels(data, option, factor) {
    const adjustedPixels = new Uint8Array(data.length);

    for (let index = 0; index < data.length - this.meta.padding; index += 3) {
      if (index + 3 > data.length - this.meta.padding) break;

      const bgr = data.subarray(index, index + 3);
      adjustedPixels.set(this.adjust[option](bgr, factor), index);
    }

    if (this.meta.padding > 0) {
      adjustedPixels.set(
        data.slice(-this.meta.padding),
        data.length - this.meta.padding,
      );
    }

    await this.writer.write(adjustedPixels);
  }

  async transformPixels(option, factor) {
    const chunkSize = this.meta.rowWidth;
    const buffer = new Uint8Array(chunkSize);

    while (await this.imgStream.read(buffer)) {
      await this.redirectPixels(buffer, option, factor);
    }
  }

  async redirectHeader() {
    await this.redirectBmpHeader();
    const size = this.read4Bytes(this.meta.bmp, 10) - this.meta.bmp.length;
    const buffer = new Uint8Array(size);
    await this.imgStream.read(buffer);

    this.meta.dib = buffer;
    this.meta.width = this.read4Bytes(this.meta.dib, 4);
    this.meta.padding = (4 - (this.meta.width * 3) % 4) % 4;
    this.meta.rowWidth = this.meta.width * 3 + this.meta.padding;

    await this.writer.write(this.meta.dib);
  }

  async processImg(option, factor) {
    await this.openFiles();
    await this.redirectHeader();
    await this.transformPixels(option, factor);
    this.closeFiles();
  }
}

const parseArgs = (options) => {
  return [options[0] || "brightness", parseInt(options[1]) || 0];
};

const main = async () => {
  const [inputFile, outputFile, ...adjustments] = Deno.args;
  const [option, factor] = parseArgs(adjustments);

  if (!(option in new ImgProcessor().adjust)) {
    console.error(`Invalid adjustment type: ${option}`);
    Deno.exit(1);
  }

  const processor = new ImgProcessor(inputFile, outputFile);
  await processor.processImg(option, factor);
};

main();
