const { createPoster, getPosters } = require("../models/posterModel");

exports.uploadPoster = async (req, res) => {
  try {
    const image_url = `/uploads/${req.file.filename}`;
    const { title } = req.body;

    await createPoster({ title, image_url });

    res.json({ message: "Poster uploaded!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.listPosters = async (req, res) => {
  const data = await getPosters();
  res.json(data);
};
