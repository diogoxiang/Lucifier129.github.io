var fs = require('fs')
var join = require('path').join
	//获取Path路径下的所有文件files
var readdir = function(path) {
	return new Promise(function(resolve, reject) {
		fs.readdir(path, function(err, files) {
			err ? reject(err) : resolve(files)
		})
	})
}

//将data写入path路径的文件中
var writeFile = function(path, data) {
	return new Promise(function(resolve, reject) {
		fs.writeFile(path, data, function(err) {
			err ? reject(err) : resolve()
		})
	})
}

//根据path判断是文件还是文件夹类型
var getPathType = function(path) {
	return new Promise(function(resolve, reject) {
		fs.stat(path, function(err, stats) {
			err ? reject(err) : resolve(stats.isDirectory() ? 'directory' : 'file')
		})
	})
}

var handlePromiseList = function(promiseList) {
	var len
		//不是数组，或者是空数组，返回[[value]]为null的promise
	if (!Array.isArray(promiseList) || !(len = promiseList.length)) {
		return Promise.resolve(null)
	} else if (len === 1) {
		//只有一个promise，返回它
		return promiseList[0]
	} else if (len > 1) {
		//有两个或两个以上的promise时，用Promise.all打包
		return Promise.all(promiseList)
	}
}

function Tree(path, name, type) {
	this.path = path
	this.name = name
	//默认为directory类型，除非type是非空字符串
	this.type = typeof type === 'string' && type ? type : 'directory'
}

Tree.prototype._saveChildren = function(files, types) {
	var that = this
	var path = this.path
	var promiseList = []
	this.children = files.map(function(filename, index) {
		var type = types[index]
		var filepath = join(path, filename)
		var tree = new Tree(filepath, filename, type)
		if (tree.type === 'directory') {
			promiseList.push(tree.readdir()) //是文件夹类型，读取目录
		}
		return tree //children里存的也是tree的实例
	})
	return handlePromiseList(promiseList)  //return promise
}
Tree.prototype._handleFiles = function(files) {
	if (!files.length) {
		this.children = [] //空文件夹，children为空数组
		return
	}
	var that = this
	var path = this.path
	var promiseList = files.map(function(filename) {
		return getPathType(join(path, filename))
	})
	return handlePromiseList(promiseList).then(function(types) {
		//拿到文件类型后，保存到children属性中
		return that._saveChildren(files, types) //return promise
	})
}

Tree.prototype.readdir = function() {
	//如果实例有promise属性，直接返回该promise，避免反复调用readdir方法的性能损耗
	if (this.promise) {
		return this.promise
	}
	var that = this
	//读取path下的所有文件
	var promise = readdir(this.path).then(function(files) {
		//拿到文件后，判断文件类型
		return that._handleFiles(files) //return promise
	}).then(function() {
		return that //return tree
	}).catch(function(err) {
		console.log(err)
	})

	Object.defineProperty(this, 'promise', {
		value: promise,
		enumerable: false
	})
	return promise
}

Tree.prototype.stringify = function() {
	return this.readdir().then(JSON.stringify) //return promise
}

Tree.prototype.saveTo = function(path) {
	return this.stringify().then(function(data) {
		return writeFile(path, data) //return promise
	})
}

module.exports = Tree