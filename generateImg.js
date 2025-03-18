const generateRandomArray = (length) => {
  const randomArray = [];
  for (let i = 0; i < length; i++) {
    randomArray.push(Math.floor(Math.random() * 256));
  }

  return randomArray;
};

class ImageGenerator {
  constructor(outputFile, height, width) {
    this.outputFile = outputFile;
    this.meta = {};
    this.meta.height = height;
    this.meta.width = width;
  }

  async generatePixels() {
    const rowLength = this.meta.rowWidth;
    const height = this.meta.height;

    // const colors = generateRandomArray(rowLength);
    // for (let index = 0; index < height; index++) {
    //   const pixelData = new Uint8Array([
    //     ...colors,
    //   ]);

    for (let index = 0; index < height; index++) {
      const pixelData = new Uint8Array([
        ...generateRandomArray(rowLength),
      ]);

      await this.writer.write(pixelData);
    }
  }

  async generateDIB() {
    const width = this.meta.width;
    const height = this.meta.height;
    const pixelDataSize = this.meta.pixelDataSize;

    const dibHeader = new Uint8Array([
      0x28,
      0x00,
      0x00,
      0x00,
      width & 0xFF,
      (width >> 8) & 0xFF,
      (width >> 16) & 0xFF,
      (width >> 24) & 0xFF,
      height & 0xFF,
      (height >> 8) & 0xFF,
      (height >> 16) & 0xFF,
      (height >> 24) & 0xFF,
      0x01,
      0x00,
      0x18,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      pixelDataSize & 0xFF,
      (pixelDataSize >> 8) & 0xFF,
      (pixelDataSize >> 16) & 0xFF,
      (pixelDataSize >> 24) & 0xFF,
      0x13,
      0x0B,
      0x00,
      0x00,
      0x13,
      0x0B,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
    ]);
    await this.writer.write(dibHeader);
  }

  async generateBMP() {
    const fileSize = this.meta.fileSize;
    const bmpHeader = new Uint8Array([
      0x42,
      0x4D,
      fileSize & 0xFF,
      (fileSize >> 8) & 0xFF,
      (fileSize >> 16) & 0xFF,
      (fileSize >> 24) & 0xFF,
      0x00,
      0x00,
      0x00,
      0x00,
      0x36,
      0x00,
      0x00,
      0x00,
    ]);

    await this.writer.write(bmpHeader);
  }

  generateMetaInfo() {
    this.meta.bpp = 3;
    this.meta.padding = (4 - (this.meta.width * this.meta.bpp) % 4) % 4;
    this.meta.rowWidth = (this.meta.width * this.meta.bpp) + this.meta.padding;
    this.meta.pixelDataSize = this.meta.rowWidth * this.meta.height;
    this.meta.fileSize = 54 + this.meta.pixelDataSize;
  }

  async generateHeader() {
    this.generateMetaInfo();
    await this.generateBMP();
    await this.generateDIB();
  }

  async generate() {
    this.output = await Deno.open(this.outputFile, {
      create: true,
      write: true,
    });
    this.writer = this.output.writable.getWriter();

    await this.generateHeader();

    await this.generatePixels();
  }
}

const main = async () => {
  const generator = new ImageGenerator(...Deno.args);
  await generator.generate();
};

main();
