const express = require("express");
const router = express.Router();
const controller = require("../controllers/requestController");

router.post("/", controller.addRequest);
router.get("/", controller.listRequests);

module.exports = router;
