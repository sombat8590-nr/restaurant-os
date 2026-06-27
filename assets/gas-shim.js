// ============================================================
// gas-shim.js  — แปลง google.script.run → fetch() PHP API
// Restaurant OS MySQL Edition
// ============================================================
//const API_URL = 'https://27.131.179.220/api/api.php'; // ← เปลี่ยนถ้า URL ต่างออกไป
const API_URL = 'http://27.131.179.220/restaurant-os/api/api.php';
//const API_URL = 'https://appfood.duckdns.org/restaurant-os/api/api.php';
// Map: ชื่อฟังก์ชัน GAS → action name + รูปแบบ args
const FN_MAP = {
  // Auth
  login:                 (u,p)       => ({action:'login',          username:u, password:p}),
  changePassword:        (u,o,n)     => ({action:'changePassword',  username:u, oldPassword:o, newPassword:n}),
  logLogin:              (u,r)       => ({action:'logLogin',        username:u, role:r}),
  logLogout:             (u,r)       => ({action:'logLogout',       username:u, role:r}),
  logActivity:           (l,r,a,d)   => ({action:'logActivity',     login:l, role:r, action:a, detail:d}),

  // Init
  getInitData:           ()          => ({action:'getInitData'}),
  getSettings:           ()          => ({action:'getSettings'}),

  // Menu
  getMenuItems:          ()          => ({action:'getMenuItems'}),
  addMenuItem:           (item)      => ({action:'addMenuItem',     ...item}),
  updateMenuItem:        (idx,item)  => ({action:'updateMenuItem',  id:idx,    ...item}),
  deleteMenuItem:        (idx)       => ({action:'deleteMenuItem',  id:idx}),
  toggleMenuStatus:      (idx,st)    => ({action:'toggleMenuStatus',id:idx,    status:st}),

  // Tables
  getTables:             ()          => ({action:'getTables'}),
  addTable:              (n)         => ({action:'addTable',        name:n}),
  renameTable:           (i,n)       => ({action:'renameTable',     id:i,      name:n}),
  deleteTable:           (i)         => ({action:'deleteTable',     id:i}),
  updateTableStatus:     (t,s)       => ({action:'updateTableStatus',tableName:t, status:s}),

  // Orders
  submitOrder:           (d)         => ({action:'submitOrder',     ...d}),
  getOrders:             (dt)        => ({action:'getOrders',       dateStr:dt||null}),
  getOrdersByTable:      (t)         => ({action:'getOrdersByTable',tableNumber:t}),
  updateOrderStatus:     (n,s)       => ({action:'updateOrderStatus',orderNumber:n, status:s}),
  cancelOrder:           (n,pw)      => ({action:'cancelOrder',     orderNumber:n}),
  markAllPaid:           (t,pt)      => ({action:'markAllPaid',     tableNumber:t, paymentType:pt||'cash'}),

  // Item-level
  cancelOrderItem:       (id)        => ({action:'cancelOrderItem', id:id}),
  setItemTakeAway:       (id,ta)     => ({action:'setItemTakeAway', id:id, isTakeAway:ta}),
  updateItemCookStatus:  (id,cs)     => ({action:'updateItemCookStatus',id:id, cookStatus:cs}),
  recalcOrderGrandTotal: (n)         => ({action:'recalcOrderGrandTotal',orderNumber:n}),

  // Discounts
  getDiscounts:          ()          => ({action:'getDiscounts'}),
  addDiscount:           (n,v,t)     => ({action:'addDiscount',     name:n, value:v, type:t}),
  updateDiscount:        (i,n,v,t)   => ({action:'updateDiscount',  id:i,  name:n, value:v, type:t}),
  deleteDiscount:        (i)         => ({action:'deleteDiscount',  id:i}),

  // Categories
  getCategories:         ()          => ({action:'getCategories'}),
  addCategory:           (n)         => ({action:'addCategory',     name:n}),
  renameCategory:        (i,n)       => ({action:'renameCategory',  id:i,  name:n}),
  deleteCategory:        (i)         => ({action:'deleteCategory',  id:i}),

  // Staff
  getStaff:              ()          => ({action:'getStaff'}),
  addStaff:              (n)         => ({action:'addStaff',        name:n}),
  renameStaff:           (i,n)       => ({action:'renameStaff',     id:i,  name:n}),
  deleteStaff:           (i)         => ({action:'deleteStaff',     id:i}),

  // Users
  getUsers:              ()          => ({action:'getUsers'}),
  addUser:               (l,p,r)     => ({action:'addUser',         login:l, password:p, role:r}),
  updateUser:            (i,l,p,r)   => ({action:'updateUser',      id:i, login:l, password:p, role:r}),
  deleteUser:            (i)         => ({action:'deleteUser',       id:i}),

  // Settings
  saveSettings:          (k,v)       => ({action:'saveSettings',    key:k, value:v}),

  // Logs
  getLoginLogs:          (l,d,t)     => ({action:'getLoginLogs',    filterLogin:l||'', filterDate:d||'', filterTime:t||''}),
  getActivityLogs:       (l,d,t,a)   => ({action:'getActivityLogs', filterLogin:l||'', filterDate:d||'', filterTime:t||'', filterAction:a||''}),
  clearLoginLog:         ()          => ({action:'clearLoginLog'}),
  clearActivityLog:      ()          => ({action:'clearActivityLog'}),

  // DM Contacts
  getDMContacts:         ()          => ({action:'getDMContacts'}),
  addDMContact:          (c)         => ({action:'addDMContact',    ...c}),
  updateDMContact:       (i,c)       => ({action:'updateDMContact', id:i+1, ...c}),
  deleteDMContact:       (i)         => ({action:'deleteDMContact', id:i+1}),

  // Dashboard
  getDashboardData:      (p,s,e)     => ({action:'getDashboardData',period:p||'daily', startDate:s||'', endDate:e||''}),

  // QR Banking
  getQRBanking:          ()          => ({action:'getQRBanking'}),
  saveQRBanking:         (u,n)       => ({action:'saveQRBanking',   url:u, note:n}),

  // Slip Upload
  uploadSlipChunk:       (sid,ci,tc,b64,fn,mt) => ({action:'uploadSlipChunk', sessionId:sid, chunkIndex:ci, totalChunks:tc, base64Chunk:b64, fileName:fn, mimeType:mt}),
  uploadSlip:            (b64,fn,mt) => ({action:'uploadSlip', base64Data:b64, fileName:fn, mimeType:mt}),

  // Admin checks
  checkAdminPassword:    (pw)        => ({action:'checkAdminPassword',     pw:pw}),
  checkSuperAdminPassword:(pw)       => ({action:'checkSuperAdminPassword',pw:pw}),
};

// ─── unwrapResult: normalize API response to what legacy code expects ───
function _unwrapResult(fnName, raw) {
  // ฟังก์ชันที่คืน array ตรง (จาก .data)
  const arrayFns = ['getMenuItems','getTables','getDiscounts','getCategories',
                    'getStaff','getUsers','getDMContacts','getNavbarButtons',
                    'getOrders','getOrdersByTable','getLoginLogs','getActivityLogs'];
  if (arrayFns.includes(fnName)) return raw.data ?? raw;

  // getInitData: คืน object ที่มี nested data fields
  if (fnName === 'getInitData') {
    return {
      ...raw,
      menu:      raw.menu ?? [],
      tables:    raw.tables ?? [],
      discounts: raw.discounts ?? [],
      categories:raw.categories ?? [],
      staff:     raw.staff ?? [],
      navbar:    raw.navbar ?? [],
      dmContacts:raw.dmContacts ?? [],
    };
  }

  // getSettings, getDashboardData, getQRBanking: คืน object โดยตรง
  if (['getSettings','getDashboardData','getQRBanking'].includes(fnName)) return raw;

  // Default: คืนทุกอย่างตามที่ API ส่งมา
  return raw;
}

// ─── google.script.run shim ─────────────────────────────────
window.google = {
  script: {
    run: new Proxy({}, {
      get(_, fnName) {
        // Builder pattern: .withSuccessHandler(cb).withFailureHandler(cb).fnName(args)
        let _success = null;
        let _failure = (e) => console.error('[GAS-SHIM]', e);

        const builder = {
          withSuccessHandler(cb) { _success = cb; return builder; },
          withFailureHandler(cb) { _failure = cb; return builder; },
          // เรียก function โดยตรง (ไม่ต้องผ่าน builder) เช่น google.script.run.login(u,p)
        };

        // เมื่อเรียก builder.fnName(args) จะถูก Proxy ดักอีกครั้ง — ใช้ Proxy ซ้อน
        const builderProxy = new Proxy(builder, {
          get(obj, name) {
            if (name in obj) return obj[name]; // withSuccessHandler, withFailureHandler
            // ชื่อ function จริง
            return (...args) => _callAPI(name, args, _success, _failure);
          }
        });

        // ถ้าเรียกตรง เช่น google.script.run.login(u,p) — fnName = 'login'
        if (fnName === 'withSuccessHandler' || fnName === 'withFailureHandler') {
          return builderProxy[fnName].bind(builderProxy);
        }

        // Direct call: google.script.run.someFunc(args...)
        return (...args) => _callAPI(fnName, args, null, (e)=>console.warn('[GAS-SHIM direct]',fnName,e));
      }
    })
  }
};

async function _callAPI(fnName, args, onSuccess, onFailure) {
  try {
    const mapper = FN_MAP[fnName];
    if (!mapper) { throw new Error(`ไม่พบ function: ${fnName}`); }
    const body = mapper(...args);

    const resp = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const raw = await resp.json();

    if (raw.success === false && raw.error) {
      if (onFailure) onFailure({ message: raw.error });
      return;
    }

    const result = _unwrapResult(fnName, raw);
    if (onSuccess) onSuccess(result);
  } catch (e) {
    console.error('[GAS-SHIM]', fnName, e);
    if (onFailure) onFailure({ message: e.message });
  }
}
