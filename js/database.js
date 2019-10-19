module.exports = function(app, db, ObjectId, upload, fs, path) {
	var YZM = '';
	const nodemailer = require('nodemailer');

	// crypto加密函数
	function md5(message) {
		var crypto = require('crypto');
		var md5 = crypto.createHash('md5');
		var digest = md5.update(message, 'utf8').digest('hex'); // hex表示16进制
		return digest;
	}

	//判断uid存在于数据库db中，
	async function isExist(db, id) {
		var where = {
			uid: id
		};
		// 等待 后面的异步任务执行完
		var result = await db.collection("user").find(where).toArray();
		return result.length;
	}

	//获得密码安全等级
	function getPsdLevel(pwd) {
		var reg = [/\d/, /[a-zA-Z]/, /\W/];
		var count = 0;
		if (pwd.length >= 6 && pwd.length <= 12)
			for (let i = 0; i < reg.length; i++) {
				if (reg[i].test(pwd))
					count++;
			}
		return count + '';
	}

	//发送邮件
	function sendMail(mailAdress, mailContent, res) {
		var transporter = nodemailer.createTransport({
			// host: 'smtp.qq.email',
			service: 'qq',
			// port: 465,
			secureConnection: true,
			auth: {
				user: '1659856121@qq.com', //邮箱号
				pass: 'cdyixsuadqjydchh', // 授权码
			}
		});
		var mailOptions = {
			from: '1659856121@qq.com', // 发送邮件的地址
			to: mailAdress, // 接收邮件的地址"1976419541@qq.com" 
			subject: "你有一条新消息", // 邮件主题
			html: mailContent, // 以HTML的格式显示，这样可以显示图片、链接、字体颜色等信息
		};
		transporter.sendMail(mailOptions, (error, info = {}) => {
			if (error) {
				return console.log(error);
			}
			res.send('操作成功');
		});
	}

	//生成验证码
	function getYzm() {
		var yzm = Math.ceil(Math.random() * 1000000) + 100000;
		if (yzm > 999999)
			yzm = Math.floor(yzm / 10);
		return yzm + "";
	}

	//将上传的文件加上后缀名
	function addSuffix(file) {
		var ind = file.originalname.lastIndexOf('.');
		var ext = file.originalname.substring(ind); //获取文件后缀
		var oldFile = path.join(__dirname, '../' + file.path);
		var newFile = path.join(__dirname, '../' + file.path + ext);
		fs.renameSync(oldFile, newFile);
		return file.filename + ext;
	}

	//账号唯一验证接口
	app.post("/checkname", async (req, res) => {
		var result = await isExist(db, req.body.uid);
		if (result === 0) {
			res.send('验证成功');
		} else {
			res.send('用户名被占用');
		}
	});

	//密码强度验证接口
	app.post("/checkpwd", (req, res) => {
		var pwd = req.body.upwd;
		res.send(getPsdLevel(pwd));
	});

	//发送验证码接口
	app.post('/getYZM', (req, res) => {
		var email = req.body.email;
		YZM = getYzm();
		setTimeout(function() {
			YZM = '';
		}, 1000 * 60 * 5);
		var message = '您本次操作的验证码是' + YZM + ',五分钟后失效。如非本人操作，请忽略此邮件。'
		var result = sendMail(email, message, res);
	});

	//验证验证码接口
	app.post('/checkYZM', (req, res) => {
		var yzm = req.body.yzm;
		if (yzm.length == 6 && yzm == YZM) {
			res.send('验证成功');
		} else {
			res.send('验证失败');
		}
	});

	//注册接口
	app.post("/register", async (req, res) => {
		var result = await isExist(db, req.body.uid);
		if (result === 0) {
			if (getPsdLevel(req.body.upwd) != '0') {
				if (getPsdLevel(req.body.yzm) == YZM) {
					var myobj = {
						uid: req.body.uid,
						upwd: md5(req.body.upwd),
						email: req.body.email,
					};
					db.collection("user").insertOne(myobj, (err, result) => {
						if (err) {
							res.send('注册失败');
						} else {
							res.send('注册成功');
						}
					});
				} else {
					res.send('验证码错误');
				}
			} else {
				res.send('密码不合法');
			}
		} else {
			res.send('用户名被占用');
		}
	});

	//密码登录接口
	app.post("/login", async (req, res) => {
		// var username = req.body.username;
		var where = {
			uid: req.body.uid,
			upwd: md5(req.body.upwd),
		};
		// 等待 后面的异步任务执行完
		var result = await db.collection("user").find(where).toArray();
		if (result.length === 0) {
			res.send('密码错误或用户名不存在');
		} else {
			if (req.body.islazy == '1') {
				var token = md5(where.uname + where.upwd + new Date().getTime());
				var updateObj = {
					$set: {
						"token": token,
					}
				}
				db.collection("user").updateOne(where, updateObj, (err, result) => {})
				res.cookie('token', token, {
					maxAge: 3600000 * 24 * 7,
				});
				setTimeout(function() {
					var updateObj = {
						$set: {
							"token": '',
						}
					}
					db.collection("user").updateOne(where, updateObj, (err, result) => {})
				}, 3600000 * 24 * 7);

			}
			res.send('登录成功');
		}
	});

	//token登录接口
	app.post('/loginoftoken', async (req, res) => {
		var token = req.cookies.token;
		if (!!token && token.length == 32) {
			var where = {
				token: token
			};
			var result = await db.collection("user").find(where).toArray();
			console.log(result)
			if (result.length === 0) {
				res.send('登录失败');
			} else {
				res.send('登录成功');
			}
		} else {
			res.send('登录失败');
		}
	});

	//修改密码接口
	app.post('/updatapwd', async (req, res) => {
		var where = {
			uid: req.body.uid,
			upwd: md5(req.body.upwd),
		};
		// 等待 后面的异步任务执行完
		var result = await db.collection("user").find(where).toArray();
		if (result.length === 0) {
			res.send('密码错误');
		} else {
			var updateObj = {
				$set: {
					upwd: md5(req.body.newupwd),
				}
			}
			db.collection("user").updateOne(where, updateObj, (err, result) => {
				if (err) {
					res.send('操作失败');
				} else {
					res.send('操作成功');
				}
			});
		}
	});

	//修改其他信息接口
	app.post('/updatainfo', async (req, res) => {
		var where = {
			uid: req.body.uid,
			upwd: md5(req.body.upwd),
		};
		var result = await db.collection("user").find(where).toArray();
		if (result.length === 0) {
			res.send('操作失败');
		} else {
			var updateObj = {
				$set: {
					uname: req.body.newuname,
					birthday: req.body.newbirthday,
					adress: req.body.newadress,
					phone: req.body.newphone,
					details: req.body.newdetails,
				}
			};
			db.collection("user").updateOne(where, updateObj, (err, result) => {
				if (err) {
					res.send('操作失败');
				} else {
					res.send('操作成功');
				}
			});
		}
	});

	//修改头像接口
	app.post('/updataicon', upload, async (req, res) => {
		var filename = addSuffix(req.file);
		var where = {
			uid: req.query.uid,
		};
		var result = await db.collection("user").find(where).toArray();
		if (result.length === 0) {
			res.send('操作失败');
		} else {
			if (!!result[0].uico) {
				var path = __dirname + '/../uploads/' + result[0].uico;
				console.log('path', path);
				fs.unlink(path, function(err) {
					console.log('错误：', err)
				});
			}
			var updateObj = {
				$set: {
					uico: filename,
				}
			};
			db.collection("user").updateOne(where, updateObj, (err, result) => {
				if (err) {
					res.send('操作失败');
				} else {
					res.send('操作成功');
				}
			});
		}
	});

	//上传身份验证接口
	app.post('/uploadidimg', upload, async (req, res) => {
		var filename = addSuffix(req.file);
		var where = {
			uid: req.query.uid,
		};
		var result = await db.collection("user").find(where).toArray();
		if (result.length === 0) {
			res.send('操作失败');
		} else {
			if (!result[0].IDimg) {
				var updateObj = {
					$set: {
						IDimg: filename,
					}
				};
				db.collection("user").updateOne(where, updateObj, (err, result) => {
					if (err) {
						res.send('操作失败');
					} else {
						res.send('操作成功');
					}
				});
			} else {
				res.send('身份认证已存在，不可修改');
			}
		}
	});

	//密码找回接口
	app.post('/resetpwd', async (req, res) => {
		var where = {
			uid: req.body.uid,
		};
		// 等待 后面的异步任务执行完
		var result = await db.collection("user").find(where).toArray();
		if (result.length === 0) {
			res.send('密码错误');
		} else {
			var newpwd = getYzm();
			var updateObj = {
				$set: {
					upwd: md5(newpwd),
				}
			};
			db.collection("user").updateOne(where, updateObj, (err, r) => {
				if (err) {
					res.send('操作失败');
				} else {
					res.send('操作成功');
				}
			});
			var msg = '您的新密码为：' + newpwd + '，此密码安全等级太低，请尽快修改！';
			sendMail(result[0].email, msg, res);
		}
	});

	//发布商品接口
	app.post('/releasegood', async (req, res) => {
		var myobj = {
			gname: req.body.gname,
			gdetails: req.body.gdetails,
			gprice: req.body.gprice,
			gtype: req.body.gtype,
			uid: req.body.uid
		};
		db.collection("goods").insertOne(myobj, (err, result) => {
			if (err) {
				res.send('操作失败');
			} else {
				res.send(result.ops[0]._id);
			}
		});
	});

	//上传商品图片接口
	app.post('/uploadgoodimg', upload, async (req, res) => {
		var filename = addSuffix(req.file);
		var where = {
			gid: req.query.gid,
		};
		var result = await db.collection("goodimg").find(where).toArray();
		if (result.length > 5) {
			res.send('图片最多可上传六张');
		} else {
			var myobj = {
				gid: req.query.gid,
				gimg: filename,
			};
			db.collection("goodimg").insertOne(myobj, (err, result) => {
				if (err) {
					res.send('操作失败');
				} else {
					res.send('操作成功');
				}
			});
		}
	});


	//查询商品信息接口
	app.post('/selectgoods', async (req, res) => {
		var where = JSON.parse(req.body.obj);
		var result = await db.collection("goods").find(where).toArray();
		for (let i = 0; i < result.length; i++) {
			var gid = result[i]._id.toString();
			result[i].img = [];
			var result2 = await db.collection("goodimg").find({
				gid: gid
			}).toArray();
			for (let j = 0; j < result2.length; j++) {
				result[i].img.push(result2[j].gimg);
			}
			result[i].jiagou = 0;
			result2 = await db.collection("cart").find({
				gid: gid
			}).toArray();
			for (let j = 0; j < result2.length; j++) {
				result[i].jiagou++;
			}
		}
		res.send(JSON.stringify(result));
	});

	//更新购物车接口
	app.post('/updatacart', async (req, res) => {
		var whereObj = {
			uid: req.body.uid,
			gid: req.body.gid
		}
		var updateObj = {
			$set: {
				amount: req.body.amount,
			}
		}
		var result = await db.collection("cart").find(whereObj).toArray(); //查询该记录
		if (result.length == 0) { //若无，则添加
			var myobj = {
				uid: req.body.uid,
				gid: req.body.gid,
				amount: req.body.amount
			}
			db.collection("cart").insertOne(myobj, (err, result) => {
				if (err) {
					res.send('操作失败');
				} else {
					res.send('操作成功');
				}
			});
		} else { //若有，则修改
			db.collection("cart").updateOne(whereObj, updateObj, (err, result) => {
				if (err) {
					res.send('操作失败');
				} else {
					res.send('操作成功');
				}
			});
		}
	});

	//查询购物车
	app.post('/selectcart', async (req, res) => {
		var where = {
			uid: req.body.uid
		};
		var result = await db.collection("cart").find(where).toArray();
		res.send(JSON.stringify(result));
	});

	//下架商品接口
	app.post('/deletegood', async (req, res) => {
		var where = {
			_id: ObjectId(req.body.gid)
		};
		db.collection("goods").deleteOne(where, (err, result) => {
			if (err) {
				res.send('操作失败');
			} else if (result.deletedCount > 0) {
				res.send('操作成功');
			} else {
				res.send('操作失败');
			}
		})
	});

	//收藏或取消收藏商品接口
	app.post('/isCollection', async (req, res) => {
		var whereObj = {
			uid: req.body.uid,
			gid: req.body.gid
		}
		var result = await db.collection("cart").find(whereObj).toArray(); //查询该记录
		if (result.length == 0) { //若无，则添加

		} else {//若有，则删除

		}
	});

	//下单接口
	app.post('/payment', async (req, res) => {});





}
