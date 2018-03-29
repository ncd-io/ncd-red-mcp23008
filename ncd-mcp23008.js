"use strict";

const MCP23008 = require("./index.js");

module.exports = function(RED){
	var sensor_pool = {};
	var loaded = [];

	//ensureDependencies(['node-red-contrib-aws', 'fail']);

	function NcdI2cDeviceNode(config){
		RED.nodes.createNode(this, config);
		this.interval = parseInt(config.interval);
		this.addr = parseInt(config.addr);
		this.onchange = config.onchange;
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
		var status = "{}";
		function send_payload(_status){
			if(node.onchange && JSON.stringify(_status) == status) return;
			var msg = [],
				dev_status = {topic: 'device_status', payload: _status};
			if(config.output_all){
				var old_status = JSON.parse(status);
				for(var i in _status){
					if(node.onchange && _status[i] == old_status[i]){
						msg.push(null);
					}else msg.push({topic: i, payload: _status[i]})
				}
				msg.push(dev_status);
			}else{
				msg = dev_status;
			}
			status = JSON.stringify(_status);
			node.send(msg);
		}
		function get_status(msg, repeat, _node){
			if(repeat) clearTimeout(sensor_pool[_node.id].timeout);
			if(device_status(_node)){
				_node.sensor.get().then((res) => {
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
				sensor_pool[_node.id].timeout = setTimeout(() => {
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
						send_payload(res);
					}).catch((err) => {
						//console.log(err);
					});
				}else{
					console.log(node.sensor.settable);
				}
			}
		});
		node.on('close', (removed, done) => {
			if(removed){
				clearTimeout(sensor_pool[node.id].timeout);
				delete(sensor_pool[node.id]);
			}
			done();
		});
	}
	RED.nodes.registerType("ncd-mcp23008", NcdI2cDeviceNode)
}
