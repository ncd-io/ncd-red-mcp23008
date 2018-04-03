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

		var node = this;
		var status = "{}";

		function device_status(){
			if(!node.sensor.initialized){
				node.status({fill:"red",shape:"ring",text:"disconnected"});
				return false;
			}
			node.status({fill:"green",shape:"dot",text:"connected"});
			return true;
		}

		function start_poll(){
			if(node.interval && !sensor_pool[node.id].polling){
				sensor_pool[node.id].polling = true;
				get_status(true);
			}
		}

		function stop_poll(){
			clearTimeout(sensor_pool[node.id].timeout);
			sensor_pool[node.id].polling = false;
		}

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
			if(status == "{}"){
				status = JSON.stringify(_status);
			}else{
				status = JSON.stringify(_status);
				node.send(msg);
			}
		}

		function get_status(repeat){
			if(repeat) clearTimeout(sensor_pool[node.id].timeout);
			if(device_status(node)){
				node.sensor.get().then((res) => {
					send_payload(res);
				}).catch((err) => {
					node.send({error: err});
				}).then(() => {
					if(repeat && node.interval){
						clearTimeout(sensor_pool[node.id].timeout);
						sensor_pool[node.id].timeout = setTimeout(() => {
							if(typeof sensor_pool[node.id] != 'undefined'){
								get_status(true);
							}
						}, node.interval);
					}else{
						sensor_pool[node.id].polling = false;
					}
				});
			}else{
				node.sensor.init();
				clearTimeout(sensor_pool[node.id].timeout);
				sensor_pool[node.id].timeout = setTimeout(() => {
					if(typeof sensor_pool[node.id] != 'undefined'){
						get_status(true);
					}
				}, 3000);
			}
		}




		node.on('input', (msg) => {
			stop_poll();
			if(msg.topic != 'get_status'){
				if(typeof node.sensor.settable != 'undefined' && node.sensor.settable.indexOf(msg.topic) > -1){
					node.sensor.set(msg.topic, msg.payload).then().catch().then(() => {
						start_poll()
					});
				}
			}else{
				start_poll()
			}
		});

		node.on('close', (removed, done) => {
			if(removed){
				clearTimeout(sensor_pool[node.id].timeout);
				delete(sensor_pool[node.id]);
			}
			done();
		});

		start_poll();
		device_status(node);
	}
	RED.nodes.registerType("ncd-mcp23008", NcdI2cDeviceNode)
}
