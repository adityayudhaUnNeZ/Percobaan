const { createRequest, getRequests } = require("../models/requestModel");

exports.addRequest = async (req, res) => {
  try {
    await createRequest(req.body);
    res.json({ message: "Request lagu masuk!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.listRequests = async (req, res) => {
  try {
    const data = await getRequests();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
