// index.js
const app = getApp();

Page({
  data: {
    storeName: "",
    storeCode: "",
    storeData: 0,
    monthlyData: 0,
    monthlyCost: 0,
    inventoryAlert: 0,
    loading: true,
    hasError: false,
    errorMsg: "",
    calculating: false,
    dataCalculated: false, // 添加标志，记录是否已计算过数据
  },

  onLoad: function () {
    if (app.globalData.isLoggedIn && app.globalData.store) {
      this.setStoreInfo();
      this.fetchDashboardData();

      // 注册数据更新回调
      app.dataUpdatedCallback = (data) => {
        this.setData({
          monthlyData: data.monthlyData || 0,
          monthlyCost: data.monthlyCost || 0,
          dataCalculated: true,
        });
      };
    } else {
      // 监听登录成功回调
      app.loginCallback = (res) => {
        this.setStoreInfo();
        this.fetchDashboardData();
      };
    }
  },

  onShow: function () {
    // 每次显示页面时刷新数据
    if (app.globalData.isLoggedIn && app.globalData.store) {
      this.fetchDashboardData();
    }
  },

  setStoreInfo: function () {
    const store = app.globalData.store;
    if (store) {
      this.setData({
        storeName: store.name || "",
        storeCode: store.code || "",
      });
      console.log("设置门店信息:", store);
    } else {
      console.error("门店信息不存在");
    }
  },

  fetchDashboardData: function () {
    this.setData({
      loading: true,
      hasError: false,
      errorMsg: "",
    });

    // 获取门店信息，优先使用id，如果没有则使用code
    if (!app.globalData.store) {
      console.error("门店信息不存在，无法获取统计数据");
      this.setData({
        hasError: true,
        errorMsg: "门店信息不存在，请重新登录",
        loading: false,
      });
      return;
    }

    // 优先使用ID，如果没有则使用code
    const storeId = app.globalData.store.id || app.globalData.store.code;

    console.log(
      "获取门店统计数据，门店ID:",
      storeId,
      "门店信息:",
      app.globalData.store
    );

    app
      .callCloudApi(
        `/miniprogram/stats?storeId=${storeId}`, // 使用专门为小程序提供的路径
        "GET"
      )
      .then((data) => {
        console.log("门店统计数据:", data);
        // 即使success为false也尝试使用数据，确保UI正常显示
        const statsData = data.data || {};

        // 确保月度使用量和成本正确获取
        const monthlyUsage = statsData.monthlyUsage || 0;
        const monthlyCost = statsData.monthlyCost || 0;

        // 如果返回失败但有门店信息，我们仍然显示页面但会展示错误信息
        const showError = !data.success;
        const errorMessage = data.success
          ? ""
          : data.message === "门店不存在"
          ? "门店已成功登录，但暂无统计数据"
          : data.message || "门店数据异常";

        this.setData({
          storeData: statsData.totalProducts || 0,
          monthlyData: monthlyUsage,
          monthlyCost: monthlyCost,
          inventoryAlert: statsData.totalAlerts || 0,
          hasError: showError,
          errorMsg: errorMessage,
        });

        // 保存数据到本地缓存，确保数据持久性
        try {
          wx.setStorageSync("storeData", statsData.totalProducts || 0);
          wx.setStorageSync("monthlyData", monthlyUsage);
          wx.setStorageSync("monthlyCost", monthlyCost);
          wx.setStorageSync("inventoryAlert", statsData.totalAlerts || 0);
        } catch (e) {
          console.error("保存数据到缓存失败:", e);
        }

        // 检查数据是否为0，提示用户
        if (statsData.totalProducts === 0) {
          this.setData({
            hasError: true,
            errorMsg: "当前门店没有库存数据，请先添加库存",
          });
        } else if (
          monthlyCost === 0 &&
          !this.data.calculating &&
          !this.data.dataCalculated
        ) {
          // 如果月度费用为0，自动计算使用量
          console.log("月度费用为0，自动计算使用量");
          this.calculateUsageData();
        }
      })
      .catch((err) => {
        console.error("获取门店统计数据失败:", err);
        // 即使请求失败也尝试显示基本UI
        this.setData({
          storeData: 0,
          monthlyData: 0,
          monthlyCost: 0,
          inventoryAlert: 0,
          hasError: true,
          errorMsg: "网络错误，请下拉刷新重试",
        });
      })
      .finally(() => {
        this.setData({ loading: false });
      });
  },

  // 跳转到库存页
  goToInventory: function () {
    wx.switchTab({
      url: "/pages/inventory/inventory",
    });
  },

  // 查看使用报表
  viewUsageReport: function () {
    wx.navigateTo({
      url: "/pages/usage/report",
    });
  },

  // 跳转到采购订单页
  goToOrders: function () {
    wx.switchTab({
      url: "/pages/orders/orders",
    });
  },

  // 刷新数据
  refreshData: function () {
    // 如果月度费用为0，自动计算使用报表
    if (this.data.monthlyCost === 0) {
      this.calculateUsageData();
    } else {
      this.fetchDashboardData();
    }
  },

  // 计算使用数据
  calculateUsageData: function () {
    this.setData({
      calculating: true,
      loading: true,
      hasError: false,
      errorMsg: "",
    });

    // 获取当前月份
    const date = new Date();
    const month =
      date.getFullYear() +
      "-" +
      (date.getMonth() + 1).toString().padStart(2, "0");

    wx.showLoading({
      title: "正在计算使用数据...",
      mask: true,
    });

    // 调用计算API - 使用云托管调用方式
    app
      .callCloudApi("/api/usages/calculate", "POST", {
        storeId: app.globalData.store.id,
        month: month,
      })
      .then((data) => {
        console.log("计算使用数据结果:", data);
        wx.hideLoading();

        if (data.success) {
          wx.showToast({
            title: "计算完成",
            icon: "success",
            duration: 2000,
          });

          // 正确获取计算结果
          const usageData = data.data || {};
          const totalQuantity = usageData.totalUsage || 0;
          const totalCost = usageData.totalCost || 0;

          console.log(
            `更新月度统计: 使用量=${totalQuantity}, 成本=${totalCost}`
          );

          // 保存数据到本地缓存
          try {
            wx.setStorageSync("monthlyData", totalQuantity);
            wx.setStorageSync("monthlyCost", totalCost);
            wx.setStorageSync("dataCalculated", true);
          } catch (e) {
            console.error("保存数据到缓存失败:", e);
          }

          // 更新月度费用显示
          this.setData({
            monthlyData: totalQuantity,
            monthlyCost: totalCost,
            dataCalculated: true, // 标记已计算过数据
          });

          // 重新获取统计数据
          setTimeout(() => {
            this.fetchDashboardData();
          }, 1000);
        } else {
          this.setData({
            hasError: true,
            errorMsg: data.message || "计算使用数据失败，请联系管理员",
          });

          wx.showToast({
            title: data.message || "计算失败",
            icon: "none",
            duration: 2000,
          });
        }
      })
      .catch((err) => {
        wx.hideLoading();
        console.error("计算使用数据失败:", err);

        this.setData({
          hasError: true,
          errorMsg: "网络错误，请检查网络连接后重试",
        });

        wx.showToast({
          title: "网络错误",
          icon: "none",
          duration: 2000,
        });
      })
      .finally(() => {
        this.setData({
          calculating: false,
          loading: false,
        });
      });
  },
});
