var ffi = require('ffi'),
  ref = require('ref'),
  os = require('os'),
  Struct = require('ref-struct'),
  hWnd = new Buffer(8);

var ICCx = Struct({
  'dwSize': 'int32',
  'dwICC': 'int32'
});
var ICCxPtr = ref.refType(ICCx);
var comctl32 = ffi.Library('comctl32', {
  'InitCommonControlsEx': ['int32', [ICCxPtr]]
});

var WndClassEx = Struct({
  'cbSize': 'uint32',
  'style': 'uint32',
  'lpfnWndProc': 'pointer', // callback 'int32', ['pointer', 'uint32', 'int32', 'uint32']
  'cbClsExtra': 'int32',
  'cbWndExtra': 'int32',
  'hInstance': 'pointer', // can be 0?
  'hIcon': 'pointer',
  'hCursor': 'pointer',
  'hbrBackground': 'pointer',
  'lpszMenuName': 'pointer',
  'lpszClassName': 'pointer',
  'hIconSm': 'pointer'
});
var WndClassExPtr = ref.refType(WndClassEx);
var user32 = ffi.Library('user32', {
  'RegisterClassExW': ['int32', [WndClassExPtr]],
  'CreateWindowExW': ['pointer', [
    'int32', 'pointer', 'pointer', 'int32',    // style, name, name, style
    'int32', 'int32', 'int32', 'int32',        // x, y, w, h
    'pointer', 'pointer', 'pointer', 'pointer' // handles
  ]],
  'DefWindowProcW': ['uint32', ['pointer', 'uint32', 'int32', 'pointer']],
  'ShowWindow': ['bool', ['pointer', 'int32']],
  'UpdateWindow': ['bool', ['pointer']],
  'GetMessageW': ['bool', ['pointer', 'pointer', 'uint32', 'uint32']],
  'TranslateMessageEx': ['bool', ['pointer']],
  'DispatchMessageW': ['uint32', ['pointer']],
  'PostQuitMessage': ['void', ['int32']],
  'GetWindowLongW' : ['pointer', ['pointer','int32']],
  'SendMessageW':['uint32', ['pointer','uint32','int32','pointer']]
});

var kernel32 = ffi.Library('kernel32', {
  'GetModuleHandleExW': ['bool', [
    'int32', 'pointer', 'pointer' // flags, optional LPCTSTR name, ref hModule
  ]], // etc... / kernel32 is your friend!
  
  'GetCurrentProcess': ['pointer', [
  ]],
  'IsWow64Process': ['bool', [
    'pointer', 'pointer' 
  ]]
});
var gdi32 = ffi.Library('gdi32', {
  'CreateSolidBrush': ['pointer', [ 'int32' ]],  
  'SetBkColor': ['int32', [ 'pointer','int32' ]],  
  'SetTextColor': ['int32', [ 'pointer','int32' ]],  
});

var Msg = Struct({
  'hwnd': 'pointer',
  'message': 'uint32',
  'wParam': 'int32',
  'lParam': 'pointer',
  'time': 'int32',
  'pX': 'int32',
  'pY': 'int32'
});

// test os bit
var cbSize = 48;
var pthread = new Buffer(8);
var bf = new Buffer(1);
pthread = kernel32.GetCurrentProcess();
console.log("pthread => "+pthread);
var r = kernel32.IsWow64Process(pthread,bf);
console.log("IsWow64Process => "+r + "," + bf[0]);
if(r && !bf[0] && os.arch()=='x64') cbSize = 80;

// App-specific

// Names
var className = new Buffer('Node.js WinForms Class\0', 'ucs-2');
var windowName = new Buffer('Node.js WinForms App\0', 'ucs-2');

// hInstance
var hInstance = new Buffer(8);
kernel32.GetModuleHandleExW(0, null, hInstance);

// WndProc
var WndProc = ffi.Callback('uint32',
  ['pointer', 'uint32', 'int32', 'pointer'],
  function(hwnd, uMsg, wParam, lParam) {
    console.log('Got Message: ' + uMsg + ' /', hwnd.deref());
    var result = 0; // ref.alloc('int32');
    switch(uMsg) {
      case 2:
        user32.PostQuitMessage(0);
        console.log("quit hWnd=> " + hwnd.length);
        return 0;
      case 0x0133: // WM_CTLCOLOREDIT
        //gdi32.SetTextColor(wParam,0x0080ff);
        //gdi32.SetBkColor  (wParam,0xffff00);
        return 0;
        // WM_CTLCOLORLISTBOX 134 WM_CTLCOLORBTN 135
      case 0x0138: // WM_CTLCOLORSTATIC
        //gdi32.SetTextColor(wParam,0xffff00);
        //gdi32.SetBkColor  (wParam,0x0080ff);
        return 0;
      default:
        result = user32.DefWindowProcW(hwnd, uMsg, wParam, lParam);
        if(result) console.log('DefWindowProc LRESULT: ' + result );
        return result;
    }
    //console.log('Sending LRESULT: ' + result.deref())
    return result;
  }
);

// Common Controls
var icc = new ICCx;
icc.dwSize = 8;
icc.dwICC = 0x40ff;
comctl32.InitCommonControlsEx(icc.ref());

// Window Class
var wClass = new WndClassEx;
wClass.cbSize = cbSize;//48; //80; // x86 = 48
wClass.style = 3;
wClass.lpfnWndProc = WndProc;
wClass.cbClsExtra = 0;
wClass.cbWndExtra = 0;
wClass.hInstance = hInstance;
wClass.hIcon = null;
wClass.hCursor = null;
wClass.hbrBackground = gdi32.CreateSolidBrush(0xf0800f);//null;
wClass.lpszMenuName = null;
wClass.lpszClassName = className;
wClass.hIconSm = null;

if (!user32.RegisterClassExW(wClass.ref()))
  throw 'Error registering class';

hWnd = user32.CreateWindowExW(
  0,
  className,
  windowName,
  0xcf0000, // overlapped window
  1 << 31, // use default
  1 << 31,
  320,
  200,
  null, null, hInstance, null
);

var btnClassName = new Buffer('BUTTON\0', 'ucs-2');
var btnWindowName = new Buffer('Button\0', 'ucs-2');
var hInst = user32.GetWindowLongW(hWnd, -6);

var hWndButton = user32.CreateWindowExW( 
  0,
  btnClassName,   // Predefined class; Unicode assumed. 
  btnWindowName,       // Button text. 
  1342242817, //WS_TABSTOP | WS_VISIBLE | WS_CHILD | BS_DEFPUSHBUTTON,  // Styles. 
  10,         // x position. 
  10,         // y position. 
  100,        // Button width.
  30,        // Button height.
  hWnd,       // Parent window.
  null,       // No menu.
  hInst,
  null);      // Pointer not needed.

var hWndText = user32.CreateWindowExW( 
  0,
  new Buffer('EDIT\0', 'ucs-2'),   // Predefined class; Unicode assumed. 
  new Buffer('TextBox\0', 'ucs-2'),       // Button text. 
  1342242817,  
  130, 
  10,  
  100,
  16,
  hWnd,
  null,
  hInst,
  null);

var hWndStatic = user32.CreateWindowExW( 
  0,
  new Buffer('STATIC\0', 'ucs-2'),   // Predefined class; Unicode assumed. 
  new Buffer('Label\0', 'ucs-2'),       // Button text. 
  1342242817,  
  10, 
  70,  
  100,
  20,
  hWnd,
  null,
  hInst,
  null);

var hWndComboBox = user32.CreateWindowExW( 
  0,
  new Buffer('COMBOBOX\0', 'ucs-2'),   // Predefined class; Unicode assumed. 
  new Buffer('ComboBox\0', 'ucs-2'),       
  1344274947,  
  10, 
  100,  
  100,
  30,
  hWnd,
  null,
  hInst,
  null);

var hWndListBox = user32.CreateWindowExW( 
  0,
  new Buffer('LISTBOX\0', 'ucs-2'),   // Predefined class; Unicode assumed. 
  new Buffer('ListBox1\0', 'ucs-2'),        
  1342242817,  
  150, 
  50,  
  100,
  80,
  hWnd,
  null,
  hInst,
  null);


console.log("handles=> "+hWnd+"[btn="+hWndButton+"]");

var flag = user32.ShowWindow(hWnd, 1);
//console.log("ShowWindow => " + flag);
flag = user32.UpdateWindow(hWnd);
//console.log("UpdateWindow => " + flag);

// var someBuffer = new Buffer('whatever');
// var buf = ref.alloc('pointer');
// ref.writePointer(buf, 0, someBuffer);

user32.SendMessageW(hWndComboBox,0x0143,0,new Buffer('大漠穷秋\0', 'ucs-2'));
user32.SendMessageW(hWndComboBox,0x0143,0,new Buffer('太空飞猪\0', 'ucs-2'));
user32.SendMessageW(hWndComboBox,0x014e,0,null);

user32.SendMessageW(hWndListBox,0x0180,0,new Buffer('大漠穷秋\0', 'ucs-2'));
user32.SendMessageW(hWndListBox,0x0180,0,new Buffer('太空飞猪\0', 'ucs-2'));
user32.SendMessageW(hWndListBox,0x0186,1,null);

// message loop
var msg = new Msg;
var getMsgRes = 0;
while (user32.GetMessageW(msg.ref(), null, 0, 0)) {
  user32.TranslateMessageEx(msg.ref());
  user32.DispatchMessageW(msg.ref());
}

return msg.wParam;