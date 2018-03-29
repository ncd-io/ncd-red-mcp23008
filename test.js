var comms = require('ncd-red-comm');
var MCP23008 = require('./index.js');

/*
 * Allows use of a USB to I2C converter form ncd.io
 */
var port = '/dev/tty.usbserial-DN03Q7F9';
var serial = new comms.NcdSerial('/dev/tty.usbserial-DN03Q7F9', 115200);
var comm = new comms.NcdSerialI2C(serial, 0);
/*
 * Use the native I2C port on the Raspberry Pi
 */
//var comm = new comms.NcdI2C(1);

/*
 * Initialize as a 4-channel relay board
 */
// 1 = output, 2 = input
 var config = {
	 io_1: 1,
	 io_2: 1,
	 io_3: 1,
	 io_4: 1,
	 io_5: 0,
	 io_6: 0,
	 io_7: 0,
	 io_8: 0
 }

 var relay_board = new MCP23008(0x20, config, comm);

 var current_relay = 1;

 function switch_relay(){
	 relay_board.get().then((status) => {
		 //channel_1 is the first argument to set the first GPIO
		 var ch = 'channel_'+current_relay;

		 //a value of 1 will turn on an output, 0 will turn it off
		 var update = status[ch] == 1 ? 0 : 1;

		 relay_board.set(ch, update).then(() => {
			 if(current_relay == 4) current_relay = 1;
			 else current_relay++;
			 switch_relay();
		 }).catch(console.log);
	 }).catch(console.log);
 }
switch_relay();
