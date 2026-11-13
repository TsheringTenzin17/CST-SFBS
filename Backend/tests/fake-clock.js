// Pins "now" so the weekly booking window is predictable (used only by the tests).
const RealDate = Date;
const fake = RealDate.parse(process.env.FAKE_NOW || '');
if (!Number.isNaN(fake)) {
  const offset = fake - RealDate.now();
  global.Date = class extends RealDate {
    constructor(...args) { if (args.length === 0) super(RealDate.now() + offset); else super(...args); }
    static now() { return RealDate.now() + offset; }
  };
}
