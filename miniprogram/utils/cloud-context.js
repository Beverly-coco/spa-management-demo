// 云托管API访问工具
const CLOUD_ENV = "prod-7gtl9dal1828b968";
const SERVICE_NAME = "fanghu";

// 初始化云环境
function initCloud() {
  if (!wx.cloud) {
    console.error("请使用 2.2.3 或以上的基础库以使用云能力");
    return false;
  }

  try {
    wx.cloud.init({
      env: CLOUD_ENV,
      traceUser: true,
    });
    return true;
  } catch (e) {
    console.error("云环境初始化失败:", e);
    return false;
  }
}

// 调用云托管API
function callContainerApi(path, method, data = {}, header = {}) {
  return new Promise((resolve, reject) => {
    wx.cloud.callContainer({
      config: {
        env: CLOUD_ENV,
      },
      path: path,
      method: method,
      data: data,
      header: {
        "X-WX-SERVICE": SERVICE_NAME,
        ...header,
      },
      success: (res) => {
        resolve(res.data);
      },
      fail: (err) => {
        console.error("云托管调用失败:", err);
        reject(err);
      },
    });
  });
}

module.exports = {
  initCloud,
  callContainerApi,
  CLOUD_ENV,
  SERVICE_NAME,
};
