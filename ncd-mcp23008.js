"use strict";

function ensureDependencies(deps){
	//deps is just an array of dependencies that should be NPM installable, if no version is
	//required, and array of string may be sent, if a version is needed, an array of objects:
	//{name: "module-name", version: "^3.0.0"}
	var registry = require(require.main.filename.replace('red.js', 'red/runtime/nodes/registry/index.js'));
	var modules = registry.getModuleList();
	deps.forEach((mod) => {
		var o = typeof mod == "object";
		var m = o ? mod.name : mod;
		var v = o ? mod.verison : false;
		if(typeof modules[m] == 'undefined'){
			registry.installModule(m, v).then().catch((err) => {
				console.log("ensureDependencies Failed to install "+m+" from "+module.filename);
			});
		}
	});
}

module.exports = function(RED){
	var sensor_pool = {};
	var loaded = [];

	//ensureDependencies(['node-red-contrib-aws', 'fail']);

	function NcdI2cDeviceNode(config){
		RED.nodes.createNode(this, config);

		//console.log(_nodes.children);
		//console.log(require.main.children);
		//console.log(RED.nodes.getNodeList());
		this.interval = parseInt(config.interval);
		this.addr = parseInt(config.addr);
		this.onchange = config.onchange;
		// console.log(RED.registry.getModuleList());
		// DM.checkDeps([
		// 	'node-red-contrib-aws',
		// ]);
		//nodes.installModule(name)
		if(typeof sensor_pool[this.id] != 'undefined'){
			//Redeployment
			clearTimeout(sensor_pool[this.id].timeout);
			delete(sensor_pool[this.id]);
		}
		this.sensor = new MCP23008(this.addr, config, RED.nodes.getNode(config.connection).i2c);
		sensor_pool[this.id] = {
			sensor: this.sensor,
			polling: false,
			timeout: 0,
			node: this
		}
		function device_status(_node){
			if(!_node.sensor.initialized){
				_node.status({fill:"red",shape:"ring",text:"disconnected"});
				return false;
			}
			_node.status({fill:"green",shape:"dot",text:"connected"});
			return true;
		}
		var node = this;
		var status;
		function send_payload(_status){
			var msg = [],
				dev_status = {topic: 'device_status', payload: _status};
			if(config.output_all){
				for(var i in _status){
					if(_status[i] == status[i]) msg.push(null);
					else msg.push({topic: i, payload: _status[i]})
				}
				msg.push(dev_status);
			}else{
				msg = dev_status;
			}
			node.send(msg);
		}
		function get_status(msg, repeat, _node){
			if(repeat) clearTimeout(sensor_pool[_node.id].timeout);
			if(device_status(_node)){
				_node.sensor.get().then((res) => {
					if(_node.onchange && JSON.stringify(res) == status) return;
					status = JSON.stringify(res);
					send_payload(res);
				}).catch((err) => {
					_node.send({error: err});
				}).then(() => {
					if(repeat){
						if(_node.interval){
							sensor_pool[_node.id].timeout = setTimeout(() => {
								get_status({sensor: sensor_pool[_node.id].node}, true, sensor_pool[_node.id].node);
							}, _node.interval);
						}else{
							sensor_pool[_node.id].polling = false;
						}
					}
				});
			}else{
				_node.sensor.init();
				setTimeout(() => {
					get_status({sensor: sensor_pool[_node.id].node}, repeat, sensor_pool[_node.id].node);
				}, 3000);
			}
		}

		if(node.interval && !sensor_pool[node.id].polling){
			sensor_pool[node.id].polling = true;
			get_status({sensor: node}, true, sensor_pool[this.id].node);
		}
		device_status(node);
		node.on('input', (msg) => {
			if(msg.topic == 'get_status'){
				get_status(msg, false, sensor_pool[this.id].node);
			}else{
				if(typeof node.sensor.settable != 'undefined' && node.sensor.settable.indexOf(msg.topic) > -1){
					node.sensor.set(msg.topic, msg.payload).then((res) => {
						if(node.onchange && JSON.stringify(res) == status) return;
						status = JSON.stringify(res);
						send_payload(res);
					}).catch((err) => {
						//console.log(err);
					});
				}else{
					console.log(node.sensor.settable);
				}
			}
		});
	}
	RED.nodes.registerType("ncd-mcp23008", NcdI2cDeviceNode)
}

class MCP23008{
	constructor(addr, config, comm){
		this.data = config;
		this.comm = comm;
		this.addr = addr;
		this.settable = [];
		this.initialized = true;
		if(typeof this.init != 'undefined'){
			try{
				this.init();
			}catch(e){
				console.log({'failed to initialize': e});
				this.initialized = false;
			}
		}
	}
	init(){
		this.iodir = 0;
		this.data.ios = {};
		for(var i=8;i>0;i--){
			this.iodir = (this.iodir << 1) | (this.data["io_"+i] ? 0 : 1);
			this.data.ios[i] = this.data["io_"+i];
		}
		Promise.all([
			this.comm.writeBytes(this.addr, 0x00, this.iodir),
			// this.comm.writeBytes(this.addr, 0x01, 0),
			this.comm.writeBytes(this.addr, 0x06, this.iodir)
		]).then().catch();
		this.settable = ['all', 'channel_1', 'channel_2', 'channel_3', 'channel_4', 'channel_5', 'channel_6', 'channel_7', 'channel_8'];
		// this.comm.readBytes(this.addr, 0x00, 11).then((config) => {
		// 	let [iodir, ipol, gpint, defval, intcon, iocon, pu, intf, intcap, ioreg, olat] = config;
		//
		// 	console.log(this.iodir);
		//
		// 	var promises = [];
		// 	if(iodir != this.iodir) promises.push(this.comm.writeBytes(this.addr, 0x00, this.iodir));
		// 	if(ipol != 0) promises.push(this.comm.writeBytes(this.addr, 0x01, 0));
		// 	if(pu != this.iodir) promises.push(this.comm.writeBytes(this.addr, 0x06, this.iodir));
		//
		// 	promises.push(this.comm.readBytes(this.addr, 0x00, 11));
		//
		// 	Promise.all(promises).then((res) => {
		// 		console.log(res);
		// 	}).catch((err) => {
		// 		throw err;
		// 	});
		// }).catch((err) => {
		// 	throw err;
		// });
	}
	get(){
		var sensor = this;
		return new Promise((fulfill, reject) => {
			Promise.all([
				sensor.comm.readByte(sensor.addr, 9),
				sensor.comm.readByte(sensor.addr, 10)
			]).then((res) => {
				sensor.input_status = res[0];
				sensor.output_status = res[1];
				var readings = sensor.parseStatus();
				fulfill(readings);
			}).catch(reject);
			// sensor.comm.readBytes(sensor.addr, 0x09, 2).then((res) => {
			// 	sensor.input_status = res[0];
			// 	sensor.output_status = res[1];
			// 	var readings = sensor.parseStatus();
			// 	fulfill(readings);
			// }).catch(reject);
		});
	}
	parseStatus(){
		var ios = this.data.ios,
			readings = {};
		for(var i in ios){
			if(ios[i] == 0) readings["channel_"+i] = this.output_status & (1 << (i-1)) ? 1 : 0;
			else readings["channel_"+i] = this.input_status & (1 << (i-1)) ? 1 : 0;
		}
		return readings;
	}
	set(topic, value){
		var sensor = this;
		return new Promise((fulfill, reject) => {
			sensor.get().then((res) => {
				var status = sensor.output_status;
				if(topic == 'all'){
					if(status != value){
						sensor.output_status = value;
						sensor.comm.writeBytes(this.addr, 0x0A, value).then(fulfill(sensor.parseStatus())).catch(reject);
					}else{
						fulfill(res);
					}
				}else{
					var channel = topic.split('_')[1];
					if(value == 1){
						status |= (1 << (channel-1));
					}else if(value == 2){
						status ^= (1 << (channel-1));
					}else{
						status &= ~(1 << (channel - 1));
					}
					if(sensor.output_status != status){
						sensor.output_status = status;
						sensor.comm.writeBytes(sensor.addr, 0x09, status).then(fulfill(sensor.parseStatus())).catch(reject);
					}else{
						fulfill(sensor.parseStatus());
					}
				}
			}).catch((err) => {
				console.log(err);
				reject(err);
			});
		});
	}
}
