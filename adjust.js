class Adjust {
  #inputFile;
  #outputFile;
  #image;
  #output;
  #meta;
  #width;
  #padding;
  #rowWidth;

  constructor(inputFile, outputFile) {
    this.#inputFile = inputFile;
    this.#outputFile = outputFile;
    this.#meta = {};
    this.#width = 0;
    this.#padding = 0;
    this.#rowWidth = 0;
  }

  #adjust = {
    "brightness": (components, factor) => {
      return components.map((c) => Math.max(0, Math.min(255, c + factor)));
    },
    "negative": (components) => {
      return components.map((c) => 255 - c);
    },
    "contrast": (components, value) => {
      return components.map((c) => {
        const changed = 128 + (c - 128) * (1 + value / 100);
        return Math.max(0, Math.min(255, changed));
      });
    },
    "black-and-white": (bgr) => {
      const [b, g, r] = bgr;
      const avg = Math.round((r + g + b) / 3);
      const grayValue = Math.max(0, Math.min(255, avg));

      return [grayValue, grayValue, grayValue];
    },
  };

  //can be separated into another class for maintaing mvc model
  async processPixels(data, option, factor) {
    const adjustedPixels = new Uint8Array(data.length);

    for (let index = 0; index <= data.length - this.#padding - 3; index += 3) {
      const bgr = data.slice(index, index + 3);
      adjustedPixels.set(this.#adjust[option](bgr, factor), index);
    }

    if (this.#padding > 0) {
      adjustedPixels.set(
        data.slice(-this.#padding),
        data.length - this.#padding,
      );
    }

    await this.writer.write(adjustedPixels);
  }

  async pixelsData(size, option, factor) {
    const buffer = new Uint8Array(size);
    let bytesRead;

    while ((bytesRead = await this.#image.read(buffer)) !== null) {
      await this.processPixels(buffer.subarray(0, bytesRead), option, factor);
    }
  }

  async headerInfo(size) {
    const buffer = new Uint8Array(size);
    const bytesRead = await this.#image.read(buffer);

    if (bytesRead === null) {
      console.log("Error: Could not read file.");
      await this.closeFiles();
      return;
    }

    this.#meta.data = buffer.subarray(0, bytesRead);
    await this.writer.write(this.#meta.data);

    this.#width = this.#meta.data[18] | (this.#meta.data[19] << 8) |
      (this.#meta.data[20] << 16) | (this.#meta.data[21] << 24);
    this.#padding = (4 - (this.#width * 3) % 4) % 4;
    this.#rowWidth = this.#width * 3 + this.#padding;
  }

  async processImg(option, factor) {
    this.#image = await Deno.open(this.#inputFile);
    this.#output = await Deno.open(this.#outputFile, {
      create: true,
      write: true,
    });
    this.writer = await this.#output.writable.getWriter();

    await this.headerInfo(54);
    await this.pixelsData(this.#rowWidth, option, factor);
    await this.closeFiles();
  }

  async closeFiles() {
    if (this.#image) await this.#image.close();
    if (this.#output) await this.#output.close();
  }
}

const parse = (options) => {
  return [options[0] || "brightness", parseInt(options[1]) || 0];
};

const main = async () => {
  const [input, output, ...options] = Deno.args;
  const processor = new Adjust(input, output);
  const [option, factor] = parse(options);
  await processor.processImg(option, factor);
};

main();
