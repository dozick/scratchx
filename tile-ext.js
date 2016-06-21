// File tile-ext.js




(function (ext)
{
 // Variables
 var serial_device;
 
 var n_bytes_buffer = 1024;
 var out_buffer = new DataView (new ArrayBuffer (n_bytes_buffer));

 var n_caps = 4;
 var cap_raw_values = new Array (n_caps);
 var cap_baselines = new Array (n_caps);
 var cap_values = new Array (n_caps);
 var cap_flags = new Array (n_caps);
 

 // thresholds
 var tap_on = 100;
 var tap_off = 80;
 var tap_max = 200;

 

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
  if (! serial_device)
   return {status: 1, msg: "Not Connected" };
  else
   return {status: 2, msg: "Connected" };  
 }


 
  
 function _deviceConnected (dev)
 {
  console.log ("_deviceConnected", dev);

  if (dev.id == "/dev/tty.usbmodem1816151")
   {
    serial_device = dev;
    dev.open ({ bitRate: 115200, stopBits: 0 }, on_open);
   }
 }



 function _deviceRemoved (dev)
 {
  serial_device = null;
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
  if (! isFinite (value))
   return;
  
  cap_raw_values [index] = value;
  
  if (cap_baselines [index] === undefined)
   {
    console.log ("cap_count: baseline", index, value);
    cap_baselines [index] = value;
   }
    
 
  // fast adjust downwards
  var tc = 5;

  if (value < cap_baselines [index])
   cap_baselines [index] = ((1 / tc) * value) + (((tc - 1) / tc) * cap_baselines [index]);

  // slow adjust upwards
  var tc = 500;

  if (value > cap_baselines [index])
   cap_baselines [index] = ((1 / tc) * value) + (((tc - 1) / tc) * cap_baselines [index]);

  cap_values [index] = Math.round (value - cap_baselines [index]);

  if (cap_values [index] > tap_on)
   cap_flags [index] = true;
  
  if (cap_values [index] < tap_off)
   cap_flags [index] = false;
 }



 function on_data (data)
 {
  var text = to_string (data);
  // console.log (text);
  
  var atoms = text.split (" ");

  if (atoms [0] == "smm")
   {
    if (atoms [1] == 0)
     console.log ("on_data", atoms [1]);

    for (var i = 0; i < n_caps; i++)
     cap_count (i, Number (atoms [i + 2]));
   }
 }

 

 function on_open ()
 {
  console.log ("serial device open");

  serial_device.set_receive_handler (on_data);
  serial_device.send (to_buffer ("set_variable serial_ready 1 \n"));
 }

 

 function tile_raw (segment)
 {
  return (cap_raw_values [Number (segment)]);
 }
  


 function tile_pressure (segment)
 {
  return (cap_values [Number (segment)]);
 }
  


 function tile_flag (segment)
 {
  return (cap_flags [Number (segment)]);
 }



 function tile_pressed ()
 {
  for (var i = 0; i < n_caps; i++)
   {
    if (cap_flags [i])
     return (true);
   }
  
  return (false);
 }



 function set_color (red, green, blue)
 {
  var red = 255 * red / 100;
  var green = 255 * green / 100;
  var blue = 255 * blue / 100;
  
  var command = (["set_leds", red, green, blue, 255, 255, "\n"] . join (" "));
  console.log (command);
  serial_device.send (to_buffer (command));
 }
 

 
 // ?? consider using utterance.onend to add "speak until done"
 
 function speak (string)
 {
  var utterance = new SpeechSynthesisUtterance (string);
  speechSynthesis.speak (utterance);
 }
  


 // Block and block menu descriptions
 var descriptor =
 {
  blocks:
  [
   ["r", "tile %m.segment raw", "tile_raw", 0],
   ["r", "tile %m.segment pressure", "tile_pressure", 0],
   ["r", "tile %m.segment flag", "tile_flag", 0],
   ["r", "tile is pressed", "tile_pressed", 0],
   [" ", "speak %s", "speak", ""],
   [" ", "set tile to red %n green %n blue %n", "set_color", 0, 0, 0]
   ],

  menus:
  {
   segment: [0, 1, 2, 3],
   color: ["red", "green", "blue"],
   color_value: ["off", "on"]
  }
 };



 // export module properties
 ext._shutdown = _shutdown;
 ext._getStatus = _getStatus;
 ext._deviceConnected = _deviceConnected;
 ext._deviceRemoved = _deviceRemoved;

 ext.tile_raw = tile_raw;
 ext.tile_pressure = tile_pressure;
 ext.tile_flag = tile_flag;
 ext.tile_pressed = tile_pressed;
 ext.speak =  speak;
 ext.set_color = set_color;

 
 
 // register the extension
 ScratchExtensions.register ("JumpSmart", descriptor, ext, { type: "serial" });

})
( {} ) ;



