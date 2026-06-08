// pages/usage/report.js
const app = getApp();

Page({
  data: {
    usages: [],
    totalCost: 0,
    currentMonth: "",
    loading: true,
    months: [], // 可选择的月份列表
    hasError: false,
    errorMsg: "",
    calculating: false,
  },

  onLoad: function (options) {
    // 生成最近12个月的月份列表
    const date = new Date();
    const months = [];
    for (let i = 0; i < 12; i++) {
      const m = new Date(date.getFullYear(), date.getMonth() - i, 1);
      const monthStr =
        m.getFullYear() + "-" + (m.getMonth() + 1).toString().padStart(2, "0");
      months.push({
        value: monthStr,
        label: monthStr,
      });
    }

    // 设置当前月份
    const currentMonth = months[0].value;

    this.setData({
      months,
      currentMonth,
    });

    if (app.globalData.store && app.globalData.store.id) {
      this.fetchUsageData(currentMonth);
    } else {
      console.error("门店ID不存在，无法获取数据");
      this.setData({
        loading: false,
        hasError: true,
        errorMsg: "门店信息不存在，请重新登录",
      });
    }
  },

  // 月份选择器变化
  bindMonthChange: function (e) {
    const month = this.data.months[e.detail.value].value;
    this.setData({
      currentMonth: month,
    });
    this.fetchUsageData(month);
  },

  // 获取使用记录数据
  fetchUsageData: function (month) {
    this.setData({
      loading: true,
      hasError: false,
      errorMsg: "",
    });

    if (!app.globalData.store || !app.globalData.store.id) {
      console.error("门店ID不存在，无法获取数据");
      this.setData({
        loading: false,
        hasError: true,
        errorMsg: "门店信息不存在，请重新登录",
      });
      return;
    }

    console.log(
      "获取使用记录，月份:",
      month,
      "门店ID:",
      app.globalData.store.id
    );

    // 使用云托管调用方式
    app
      .callCloudApi(
        `/api/usages?month=${month}&storeId=${app.globalData.store.id}&limit=100`,
        "GET"
      )
      .then((data) => {
        console.log("使用报表数据:", data);

        if (data.success) {
          if (data.items && data.items.length > 0) {
            // 确保每个使用记录有正确的价格和成本计算
            const usages = data.items.map((item) => {
              // 确保产品价格存在
              const price = item.product.price || 0;
              // 计算成本
              const cost = (price * item.quantity).toFixed(2);

              return {
                ...item,
                cost: parseFloat(cost),
              };
            });

            const totalCost = data.totalCost || this.calculateTotalCost(usages);

            this.setData({
              usages: usages,
              totalCost: totalCost,
              hasError: false,
            });
          } else {
            // 没有数据的情况
            this.setData({
              usages: [],
              totalCost: 0,
              hasError: true,
              errorMsg:
                data.message || "当前月份没有使用记录数据，点击计算按钮生成",
            });
          }
        } else {
          this.setData({
            hasError: true,
            errorMsg: data.message || "获取数据失败",
          });
        }
      })
      .catch((err) => {
        console.error("获取使用报表失败:", err);
        this.setData({
          hasError: true,
          errorMsg: "网络错误，请检查网络连接",
        });
      })
      .finally(() => {
        this.setData({ loading: false });
      });
  },

  // 计算总费用
  calculateTotalCost: function (usages) {
    return usages
      .reduce((sum, item) => sum + (parseFloat(item.cost) || 0), 0)
      .toFixed(2);
  },

  // 刷新数据
  refreshData: function () {
    // 如果没有数据，自动计算
    if (this.data.usages.length === 0) {
      this.calculateUsageData();
    } else {
      this.fetchUsageData(this.data.currentMonth);
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

    wx.showLoading({
      title: "正在计算使用数据...",
      mask: true,
    });

    // 使用云托管调用方式
    app
      .callCloudApi("/api/usages/calculate", "POST", {
        storeId: app.globalData.store.id,
        month: this.data.currentMonth,
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

          // 重新获取使用数据
          setTimeout(() => {
            this.fetchUsageData(this.data.currentMonth);
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
