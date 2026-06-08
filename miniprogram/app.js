// app.js
App({
  onLaunch: function () {
    // 初始化云托管环境
    if (!wx.cloud) {
      console.error("请使用 2.2.3 或以上的基础库以使用云能力");
    } else {
      wx.cloud.init({
        env: "prod-7gtl9dal1828b968",
        traceUser: true,
      });
      console.log("云开发初始化成功");

      // 立即预热云服务，避免首次登录超时
      this.warmupCloudService();
    }

    // 检查是否有登录状态
    const token = wx.getStorageSync("token");
    const storeId = wx.getStorageSync("storeId");
    const storeName = wx.getStorageSync("storeName");
    const storeCode = wx.getStorageSync("storeCode");

    if (token && storeId) {
      this.globalData.isLoggedIn = true;
      this.globalData.store = {
        id: storeId,
        name: storeName,
        code: storeCode,
      };
      console.log("已从缓存获取登录信息");
    }
  },

  // 预热云服务，避免冷启动导致的首次请求超时
  warmupCloudService: function () {
    console.log("开始预热云服务...");

    // 发送预热请求到健康检查端点
    wx.cloud.callContainer({
      config: {
        env: this.globalData.cloudEnv,
      },
      path: "/health",
      method: "GET",
      header: {
        "X-WX-SERVICE": "fanghu",
      },
      timeout: 10000, // 预热请求超时设置为10秒
      success: (res) => {
        console.log("云服务预热成功:", res);
        this.globalData.serviceWarmedUp = true;
      },
      fail: (err) => {
        console.log("云服务预热失败（这是正常的，服务可能正在启动）:", err);
        // 预热失败不影响应用运行，服务会在用户真正请求时启动
        // 可以在后台静默重试
        setTimeout(() => {
          console.log("尝试第二次预热...");
          this.retryWarmup(1);
        }, 3000);
      },
    });
  },

  // 重试预热（最多重试2次）
  retryWarmup: function (retryCount) {
    if (retryCount > 2) {
      console.log("预热重试次数已达上限，停止重试");
      return;
    }

    wx.cloud.callContainer({
      config: {
        env: this.globalData.cloudEnv,
      },
      path: "/ping",
      method: "GET",
      header: {
        "X-WX-SERVICE": "fanghu",
      },
      timeout: 15000,
      success: (res) => {
        console.log(`第${retryCount}次预热成功:`, res);
        this.globalData.serviceWarmedUp = true;
      },
      fail: (err) => {
        console.log(`第${retryCount}次预热失败:`, err);
        if (retryCount < 2) {
          setTimeout(() => {
            console.log(`尝试第${retryCount + 1}次预热...`);
            this.retryWarmup(retryCount + 1);
          }, 5000);
        }
      },
    });
  },

  globalData: {
    userInfo: null,
    store: null,
    isLoggedIn: false,
    serviceWarmedUp: false, // 云服务预热状态
    // 根据实际环境配置API地址
    // 云托管环境 - 使用云托管服务路径
    apiBaseUrl: "/api", // 使用相对路径，通过callContainer调用
    miniApiBaseUrl: "/miniprogram", // 使用相对路径，通过callContainer调用
    cloudEnv: "prod-7gtl9dal1828b968", // 云环境ID
    cloudRegion: "ap-shanghai", // 云环境地域
    storageBucket: "7072-prod-7gtl9dal1828b968-1369787417", // 对象存储桶ID
    // 本地环境 - 保留这些注释便于切换环境
    // apiBaseUrl: "http://localhost:5000/api/v1", // 本地开发环境
    // apiBaseUrl: "http://10.70.218.171:5000/api/v1", // 真机调试环境
    version: "1.0.0",
    monthlyData: 0,
    monthlyCost: 0,
    inventoryAlert: 0,
  },

  // 修改获取图片URL的工具函数
  getImageUrl(imagePath) {
    // 如果路径为空，返回默认图片
    if (!imagePath) {
      console.log("空图片路径，使用默认图片");
      return `https://${this.globalData.storageBucket}.tcb.qcloud.la/uploads/no-photo.jpg`;
    }

    // 如果是完整URL，直接返回
    if (imagePath.startsWith("http")) {
      return imagePath;
    }

    // 添加时间戳防止缓存
    const timestamp = Date.now();

    // 获取文件名
    let fileName = imagePath;
    if (imagePath.includes("uploads/")) {
      fileName = imagePath.split("uploads/").pop();
    }

    // 添加调试信息
    console.log(`生成图片URL: 原始路径=${imagePath}, 提取文件名=${fileName}`);

    try {
      // 先尝试使用云存储地址
      const cloudUrl = `https://${this.globalData.storageBucket}.tcb.qcloud.la/uploads/${fileName}?t=${timestamp}`;

      // 同时为前端提供一个备用URL
      const backupUrl = `/api/image/${fileName}?t=${timestamp}`;

      // 在控制台输出生成的URL，方便调试
      console.log(`云存储图片URL: ${cloudUrl}`);

      return cloudUrl;
    } catch (error) {
      console.error(`生成图片URL失败: ${error.message}`);
      return `https://${this.globalData.storageBucket}.tcb.qcloud.la/uploads/no-photo.jpg?t=${timestamp}`;
    }
  },

  // 跳转到登录页面
  redirectToLogin() {
    wx.redirectTo({
      url: "/pages/login/login",
    });
  },

  // 云托管调用封装方法
  callCloudApi: function (path, method, data = {}) {
    // 处理数字类型数据，避免传输过程中类型丢失
    const processedData = this.processDataForApi(data);

    return new Promise((resolve, reject) => {
      wx.cloud.callContainer({
        config: {
          env: this.globalData.cloudEnv,
        },
        path: path,
        method: method,
        data: processedData,
        header: {
          "X-WX-SERVICE": "fanghu", // 服务名为fanghu
        },
        timeout: 60000, // 设置超时时间为60秒（1分钟）
        success: (res) => {
          // 处理返回的数据，确保金额类型正确
          const processedResponse = this.processApiResponse(res.data);
          resolve(processedResponse);
        },
        fail: (err) => {
          console.error("云托管调用失败:", err);
          reject(err);
        },
      });
    });
  },

  // 处理API请求数据
  processDataForApi: function (data) {
    if (!data || typeof data !== "object") return data;

    // 创建一个新对象，避免修改原始数据
    const result = Array.isArray(data) ? [] : {};

    // 处理每个属性
    for (const key in data) {
      if (data.hasOwnProperty(key)) {
        const value = data[key];

        // 递归处理嵌套对象
        if (value && typeof value === "object") {
          result[key] = this.processDataForApi(value);
        } else {
          result[key] = value;
        }
      }
    }

    return result;
  },

  // 处理API响应数据
  processApiResponse: function (data) {
    if (!data || typeof data !== "object") return data;

    // 创建一个新对象，避免修改原始数据
    const result = Array.isArray(data) ? [] : {};

    // 处理每个属性
    for (const key in data) {
      if (data.hasOwnProperty(key)) {
        const value = data[key];

        // 处理金额字段
        if (
          key === "total_amount" ||
          key === "unit_price" ||
          key === "subtotal" ||
          key === "price"
        ) {
          if (value !== null && value !== undefined) {
            // 确保金额是数字类型
            result[key] = typeof value === "string" ? parseFloat(value) : value;
          } else {
            result[key] = 0;
          }
        }
        // 递归处理嵌套对象
        else if (value && typeof value === "object") {
          result[key] = this.processApiResponse(value);
        } else {
          result[key] = value;
        }
      }
    }

    return result;
  },
});
