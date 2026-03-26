const { createGreeting, getGreetings } = require("../models/greetingModel");

exports.addGreeting = async (req, res) => {
  try {
    await createGreeting(req.body);
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
