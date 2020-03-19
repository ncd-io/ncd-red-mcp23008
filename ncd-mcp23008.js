"use strict";

const MCP23008 = require("./index.js");
const comm = require("ncd-red-comm");

process.on('unhandledRejection', error => {
  console.log('unhandledRejection', error);
});


module.exports = function(RED){
	var sensor_pool = {};
	var loaded = [];

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
		if(config.persist){
			this.settings = comm.NcdSettings(config, this.context().global);
		}
		var node = this;
		var status = "{}";
		var last_status = false;

		function device_status(){
			if(!node.sensor.initialized){
				node.status({fill:"red",shape:"ring",text:"disconnected"});
				return false;
			}
			node.status({fill:"green",shape:"dot",text:"connected"});
			return true;
		}

		function start_poll(force){
			if(node.interval && !sensor_pool[node.id].polling){
				stop_poll();
				sensor_pool[node.id].polling = true;
				get_status(true, force);
			}
		}

		function stop_poll(){
			clearTimeout(sensor_pool[node.id].timeout);
			sensor_pool[node.id].polling = false;
		}

		function restore_state(){
			var state;
			if(config.persist && node.settings.last_state){
				state = node.settings.last_state;
			}else if(config.startup){
				state = config.startup*1;
			}else return;

			stop_poll();
			node.sensor.set('all', state).then().catch().then(() => {
				start_poll();
			});
		}

		function send_payload(_status, force){
			if(!force && node.onchange && JSON.stringify(_status) == status) return;
			var msg = [],
				dev_status = {topic: 'device_status', payload: _status};
			if(config.output_all){
				var old_status = JSON.parse(status);
				for(var i in _status){
					if(!force && node.onchange && _status[i] == old_status[i]){
						msg.push(null);
					}else msg.push({topic: i, payload: _status[i]})
				}
				msg.push(dev_status);
			}else{
				msg = dev_status;
			}
            if("interrupt" in _status) delete _status.interrupt;
			status = JSON.stringify(_status);
            if(!(!config.send_init && status == "{}")){
				node.send(msg);
			}
		}

		function get_status(repeat, force){
			if(repeat) clearTimeout(sensor_pool[node.id].timeout);
			if(device_status(node)){
				if(!last_status){
					last_status = true;
					restore_state();
				}
				node.sensor.get().then((res) => {
					send_payload(res, force);
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
				last_status = false;
				clearTimeout(sensor_pool[node.id].timeout);
				node.sensor.init();
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
					node.sensor.set(msg.topic, msg.payload).then((_status) => {
						if(config.persist) node.settings.last_state = node.sensor.output_status;
					}).catch().then(() => {
						start_poll()
					});
				}
			}else{
				start_poll(true);
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
