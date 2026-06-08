// pages/profile/profile.js
const app = getApp();

Page({
  data: {
    storeName: "",
    storeCode: "",
    version: "",
  },

  onLoad: function () {
    this.setData({
      version: app.globalData.version,
    });

    if (app.globalData.isLoggedIn && app.globalData.store) {
      this.setStoreInfo();
    } else {
      // 监听登录成功回调
      app.loginCallback = (res) => {
        this.setStoreInfo();
      };
    }
  },

  onShow: function () {
    // 每次显示页面时刷新数据
    if (app.globalData.isLoggedIn && app.globalData.store) {
      this.setStoreInfo();
    }
  },

  setStoreInfo: function () {
    const store = app.globalData.store;
    this.setData({
      storeName: store.name,
      storeCode: store.code,
    });
  },

  // 跳转到使用报表
  goToUsageReport: function () {
    wx.navigateTo({
      url: "/pages/usage/report",
    });
  },

  // 联系我们
  contactUs: function () {
    wx.showModal({
      title: "联系我们",
      content: `如有问题，请联系系统管理员\n电话：13801710605`,
      showCancel: false,
    });
  },

  // 关于系统
  aboutSystem: function () {
    wx.showModal({
      title: "关于系统",
      content:
        "方壶SPA管理系统\n版本：" +
        this.data.version +
        "\n© 2025 成都星睿棱镜科技有限公司",
      showCancel: false,
    });
  },

  // 退出登录
  logout: function () {
    wx.showModal({
      title: "退出登录",
      content: "确定要退出登录吗？",
      success: (res) => {
        if (res.confirm) {
          // 清除登录信息
          wx.removeStorageSync("token");
          wx.removeStorageSync("store");
          app.globalData.isLoggedIn = false;
          app.globalData.store = null;

          // 跳转到登录页
          wx.reLaunch({
            url: "/pages/login/login",
          });
        }
      },
    });
  },
});
