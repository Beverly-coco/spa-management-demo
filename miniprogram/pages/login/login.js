// pages/login/login.js
const app = getApp();

Page({
  data: {
    storeCode: "S001", // 默认填入测试门店编号
    loading: false,
    error: "",
  },

  onLoad: function (options) {
    // 页面加载时检查是否已登录
    if (app.globalData.isLoggedIn) {
      this.redirectToIndex();
    }

    // 打印API地址，方便调试
    console.log("当前API地址:", app.globalData.apiBaseUrl);
    console.log("当前小程序API地址:", app.globalData.miniApiBaseUrl);

    // 如果服务尚未预热，在这里再触发一次
    if (!app.globalData.serviceWarmedUp) {
      console.log("登录页：服务尚未预热，发起预热请求");
      this.warmupServiceForLogin();
    } else {
      console.log("登录页：服务已预热完成");
    }
  },

  // 为登录准备服务预热
  warmupServiceForLogin: function () {
    wx.cloud.callContainer({
      config: {
        env: app.globalData.cloudEnv,
      },
      path: "/ping",
      method: "GET",
      header: {
        "X-WX-SERVICE": "fanghu",
      },
      timeout: 10000,
      success: (res) => {
        console.log("登录页预热成功:", res);
        app.globalData.serviceWarmedUp = true;
      },
      fail: (err) => {
        console.log("登录页预热中...", err);
        // 静默失败，不影响用户体验
      },
    });
  },

  // 输入框事件
  inputStoreCode: function (e) {
    this.setData({
      storeCode: e.detail.value,
    });
  },

  // 登录按钮点击事件
  handleLogin: function () {
    const { storeCode } = this.data;

    if (!storeCode.trim()) {
      this.setData({
        error: "请输入门店编号",
      });
      return;
    }

    this.setData({
      loading: true,
      error: "",
    });

    // 打印请求信息，方便调试
    console.log("发送登录请求:", {
      url: app.globalData.miniApiBaseUrl + "/login",
      code: storeCode,
    });

    // 处理登录前显示加载提示
    wx.showLoading({
      title: "登录中...",
      mask: true,
    });

    // 使用云托管调用方式
    app
      .callCloudApi(app.globalData.miniApiBaseUrl + "/login", "POST", {
        code: storeCode,
      })
      .then((data) => {
        wx.hideLoading();
        console.log("登录响应:", data);

        if (data && data.success) {
          // 登录成功，保存token和门店信息
          const { token, store_id, store_name, store_code, open_id } =
            data.data;

          // 保存登录状态
          wx.setStorageSync("token", token);
          wx.setStorageSync("storeId", store_id);
          wx.setStorageSync("storeName", store_name);
          wx.setStorageSync("storeCode", store_code);
          // 移除假openid的保存
          // if (open_id) {
          //   wx.setStorageSync("openid", open_id);
          // }

          // 更新全局数据
          app.globalData.isLoggedIn = true;
          app.globalData.store = {
            id: store_id,
            name: store_name,
            code: store_code,
          };

          // 立即获取真实的微信openid
          this.getWechatOpenId();

          wx.showToast({
            title: "登录成功",
            icon: "success",
            duration: 1500,
          });

          // 跳转到首页
          setTimeout(() => {
            this.redirectToIndex();
          }, 1500);
        } else {
          // 登录失败
          this.setData({
            loading: false,
            error: data ? data.message : "登录失败，请检查门店编号",
          });
        }
      })
      .catch((err) => {
        wx.hideLoading();
        console.error("登录请求失败:", err);

        // 提供更详细的错误信息
        let errorMsg = "网络请求失败，请检查网络连接";
        let showRetryHint = false;

        if (err.errMsg && err.errMsg.includes("timeout")) {
          if (!app.globalData.serviceWarmedUp) {
            errorMsg = "服务正在启动中，请稍等几秒后重试";
            showRetryHint = true;
          } else {
            errorMsg = "请求超时，请重试";
          }
        } else if (err.errMsg && err.errMsg.includes("fail")) {
          errorMsg = "网络连接失败，请检查网络后重试";
        }

        this.setData({
          loading: false,
          error: errorMsg,
        });

        wx.showModal({
          title: "登录失败",
          content: showRetryHint
            ? "云服务首次启动需要一些时间，请稍等片刻后重试登录"
            : errorMsg,
          showCancel: false,
          confirmText: "我知道了",
        });
      });
  },

  // 跳转到首页
  redirectToIndex: function () {
    wx.switchTab({
      url: "/pages/index/index",
    });
  },

  // 获取微信openid
  getWechatOpenId: function () {
    const app = getApp();
    wx.login({
      success: (loginRes) => {
        if (loginRes.code) {
          console.log("获取微信登录code成功:", loginRes.code);
          app
            .callCloudApi(
              app.globalData.miniApiBaseUrl + "/wechat/openid",
              "POST",
              { code: loginRes.code }
            )
            .then((r) => {
              if (r && r.success && r.data && r.data.openid) {
                wx.setStorageSync("openid", r.data.openid);
                console.log("微信openid获取成功");
              } else {
                console.error("获取openid失败:", r);
                wx.showToast({ title: "获取微信授权失败", icon: "none" });
              }
            })
            .catch((e) => {
              console.error("获取openid异常:", e);
              wx.showToast({ title: "获取微信授权异常", icon: "none" });
            });
        } else {
          console.error("微信登录失败:", loginRes.errMsg);
          wx.showToast({ title: "微信登录失败", icon: "none" });
        }
      },
      fail: (err) => {
        console.error("调用wx.login失败:", err);
        wx.showToast({ title: "微信登录调用失败", icon: "none" });
      },
    });
  },
});
