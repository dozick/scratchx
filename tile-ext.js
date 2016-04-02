// File tile-ext.js




(function (ext)
{
 // Variables
 var serial_device;
 
 var n_bytes_buffer = 1024;
 var out_buffer = new DataView (new ArrayBuffer (n_bytes_buffer));

 var n_caps = 4;
 var cap_baselines = new Array (n_caps);
 var cap_values = new Array (n_caps);
 


 // Functions
 
 
 // _shutdown - cleanup when the extension is unloaded
 function _shutdown ()
 {
  console.log ("_shutdown");

  serial_device.close ();
  serial_device = null;
 }



 // _getStatus - report missing hardware, plugin, or unsupported browser
 function _getStatus ()
 {
  return {status: 1, msg: "Not Ready" };
 }


 
  
 function _deviceConnected (dev)
 {
  console.log ("_deviceConnected", dev);

  if (dev.id == "/dev/tty.usbmodem1459031")
   {
    serial_device = dev;
    dev.open ({ bitRate: 115200, stopBits: 0 }, on_open);
   }
 }



 function _deviceRemoved (dev)
 {
  return;
 }

 

 function to_buffer (string)
 {
  return (Uint8Array.from (string, (s) => s.charCodeAt (0)));
 }
 

 
 function to_string (buffer)
 {
  return (String.fromCharCode.apply (null, new Uint8Array (buffer)));
 }


 
 function cap_count (index, value)
 {
  if (! cap_baselines [index])
   cap_baselines [index] = value;
 
  // fast adjust downwards
  var tc = 5;

  if (value < cap_baselines [index])
   cap_baselines [index] = ((1 / tc) * value) + (((tc - 1) / tc) * cap_baselines [index]);

  // slow adjust upwards
  var tc = 500;

  if (value > cap_baselines [index])
   cap_baselines [index] = ((1 / tc) * value) + (((tc - 1) / tc) * cap_baselines [index]);

  cap_values [index] = Math.round (value - cap_baselines [index]);
 }



 function on_data (data)
 {
  var text = to_string (data);
  // console.log (text);
  
  var atoms = text.split (" ");

  if ((atoms [1] % 5) == 0)
   console.log ("on_data", atoms [1]);

  for (var i = 0; i < n_caps; i++)
   cap_count (i, Number (atoms [i + 2]));
 }

 

 function on_open ()
 {
  console.log ("serial device open");

  serial_device.set_receive_handler (on_data);
  serial_device.send (to_buffer ("set_variable serial_ready 1 \n"));
 }

 

 function tile_pressure (segment)
 {
  return (cap_values [Number (segment)]);
 }
  


 // Block and block menu descriptions
 var descriptor =
 {
  blocks:
  [
   ["r", "tile %m.segment pressure", "tile_pressure", 0]
   ],

  menus:
  {
   segment: [0, 1, 2, 3]
  }
 };



 // export module properties
 ext._shutdown = _shutdown;
 ext._getStatus = _getStatus;
 ext._deviceConnected = _deviceConnected;
 ext._deviceRemoved = _deviceRemoved;

 ext.tile_pressure = tile_pressure;


 
 // register the extension
 ScratchExtensions.register ("JumpSmart", descriptor, ext, { type: "serial" });

})
( {} ) ;



