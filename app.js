const fs = require('fs');
const path = require('path');
const express = require("express");
const app = express();

const mongodb = require("mongodb");
const MongoClient = mongodb.MongoClient;
const ObjectId = mongodb.ObjectID;

const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded());

const cookieParser = require('cookie-parser');
app.use(cookieParser());

const multer = require('multer');
const upload = multer({
	"dest": "uploads/"
}).single('inp_file1');

app.use(express.static("js"));
app.use(express.static("html"));
app.use(express.static("uploads"));

var url = "mongodb://localhost:27017/";
MongoClient.connect(url, function(err, database) {
	if (err) {
		console.log('数据库连接失败')
	}
	var db = database.db("vueproject");
	require('./js/database.js')(app, db, ObjectId, upload, fs, path);
	// database.close(); // 关闭
});

app.get("/", (req, res) => {
	res.send("123");
})


app.listen(3000);
