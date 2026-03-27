const express = require("express");
const router = express.Router();
const upload = require("../config/upload");
const controller = require("../controllers/posterController");

router.post("/", upload.single("image"), controller.uploadPoster);
router.get("/", controller.listPosters);

module.exports = router;
