const { createPoster, getPosters } = require("../models/posterModel");

exports.uploadPoster = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Image file is required" });
    }

    const image_url = `/uploads/${req.file.filename}`;
    const { title } = req.body;

    await createPoster({ title, image_url });

    res.json({ message: "Poster uploaded!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.listPosters = async (req, res) => {
  try {
    const data = await getPosters();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
