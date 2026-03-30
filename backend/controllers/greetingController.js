const { createGreeting, getGreetings } = require("../models/greetingModel");

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

exports.addGreeting = async (req, res) => {
  try {
    const name = normalizeText(req.body?.name);
    const origin = normalizeText(req.body?.origin);
    const message = normalizeText(req.body?.message);

    if (!name || !message) {
      return res.status(400).json({
        error: "Field `name` dan `message` wajib diisi",
      });
    }
    if (name.length > 100 || origin.length > 120 || message.length > 500) {
      return res.status(400).json({
        error:
          "Panjang maksimum: name 100, origin 120, message 500 karakter",
      });
    }

    await createGreeting({ name, origin, message });
    res.json({ message: "Titip salam berhasil!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.listGreetings = async (req, res) => {
  try {
    const data = await getGreetings();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
