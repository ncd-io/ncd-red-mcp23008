# MCP23008

### Overview

This library provides a class for the MCP23008, it relies on the ncd-red-comm library for communication, and includes a node-red node for the MCP23008. The MCP23008 is an Integrated port expander that controls eight I/O channels through the I2C bus. [Ncd.io](https://ncd.io) manufactures dozens of boards, both mini-modules and full size, that utilize this chip for different applications. You can see a [list here](https://store.ncd.io/?fwpcache=all&fwp_chip_name=mcp23008).

[![MCP23008](./MCP23008.png)](https://store.ncd.io/?post_type=product&s=mcp23008&site_select=https%3A%2F%2Fstore.ncd.io%3Fpost_type%3Dproduct)

### Installation

This library can be installed with npm with the following command:

```
npm install ncd-red-mcp23008
```

For use in node-red, use the same command, but inside of your node-red directory (usually `~./node-red`).

### Usage

The `test.js` file included in this library contains basic examples for use.  All of the available configurations are available in the node-red node through the UI.

### Raspberry Pi Notes

If you intend to use this on the Raspberry Pi, you must ensure that:
1. I2C is enabled (there are plenty of tutorials on this that differ based on the Pi version.)
2. Node, NPM, and Node-red should be updated to the LTS versions. If you skip this step the ncd-red-comm dependency may not load properly.
