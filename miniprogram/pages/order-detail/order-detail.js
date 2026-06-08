// pages/order-detail/order-detail.js
const app = getApp();

Page({
  data: {
    orderId: null,
    order: {},
    orderItems: [],
    orderLogs: [],
    statusText: "",
    createdAt: "",
    loading: true,
    hasError: false,
    errorMsg: "",
  },

  onLoad: function (options) {
    if (options.id) {
      this.setData({
        orderId: options.id,
      });
      this.loadOrderDetail();
    } else {
      this.setData({
        loading: false,
        hasError: true,
        errorMsg: "订单ID不存在",
      });
    }
  },

  // 发起微信支付
  handlePay: function () {
    const orderId = this.data.orderId;
    let openid = wx.getStorageSync("openid");

    // 检查openid是否存在且有效（不是假的测试openid）
    if (
      !openid ||
      openid.startsWith("openid_") ||
      openid.startsWith("store_")
    ) {
      wx.showToast({ title: "正在获取微信授权...", icon: "loading" });
      // 重新获取真实的微信openid
      this.getWechatOpenId(() => {
        // 获取成功后重新调用支付
        this.handlePay();
      });
      return;
    }

    wx.showLoading({ title: "拉起支付...", mask: true });
    app
      .callCloudApi(`/api/pay/wechat/prepay`, "POST", { orderId, openid })
      .then((resp) => {
        wx.hideLoading();
        if (!resp || !resp.success || !resp.data) {
          // 特殊处理订单重复错误
          if (resp?.error_type === "ORDER_DUPLICATE") {
            wx.showModal({
              title: "订单重复提示",
              content: "检测到已有支付订单，是否重新支付？",
              confirmText: "重新支付",
              cancelText: "取消",
              success: (modalRes) => {
                if (modalRes.confirm) {
                  // 用户确认重新支付，强制生成新订单号
                  this.retryPayment();
                }
              },
            });
            return;
          }
          wx.showToast({ title: resp?.message || "下单失败", icon: "none" });
          return;
        }
        const {
          timeStamp,
          nonceStr,
          package: pkg,
          signType,
          paySign,
        } = resp.data;
        wx.requestPayment({
          timeStamp,
          nonceStr,
          package: pkg,
          signType,
          paySign,
          success: () => {
            wx.showToast({ title: "支付成功", icon: "success" });
            // 支付成功后，延迟查询支付状态确认
            setTimeout(() => {
              this.checkPaymentStatus();
            }, 2000);
          },
          fail: (err) => {
            console.error("支付失败:", err);
            if (err.errMsg && err.errMsg.includes("cancel")) {
              wx.showToast({ title: "支付已取消", icon: "none" });
            } else {
              wx.showToast({ title: "支付失败", icon: "none" });
            }
          },
        });
      })
      .catch((err) => {
        wx.hideLoading();
        console.error("预下单异常:", err);
        wx.showToast({ title: "网络异常", icon: "none" });
      });
  },

  // 重试支付（强制生成新订单号）
  retryPayment: function () {
    const orderId = this.data.orderId;
    let openid = wx.getStorageSync("openid");

    // 检查openid是否存在且有效
    if (
      !openid ||
      openid.startsWith("openid_") ||
      openid.startsWith("store_")
    ) {
      wx.showToast({ title: "正在获取微信授权...", icon: "loading" });
      this.getWechatOpenId(() => {
        this.retryPayment();
      });
      return;
    }

    wx.showLoading({ title: "重新发起支付...", mask: true });
    app
      .callCloudApi(`/api/pay/wechat/prepay`, "POST", {
        orderId,
        openid,
        forceNew: true, // 强制生成新订单号
      })
      .then((resp) => {
        wx.hideLoading();
        if (!resp || !resp.success || !resp.data) {
          wx.showToast({
            title: resp?.message || "重新下单失败",
            icon: "none",
          });
          return;
        }
        const {
          timeStamp,
          nonceStr,
          package: pkg,
          signType,
          paySign,
        } = resp.data;
        wx.requestPayment({
          timeStamp,
          nonceStr,
          package: pkg,
          signType,
          paySign,
          success: () => {
            wx.showToast({ title: "支付成功", icon: "success" });
            setTimeout(() => {
              this.checkPaymentStatus();
            }, 2000);
          },
          fail: (err) => {
            console.error("支付失败:", err);
            if (err.errMsg && err.errMsg.includes("cancel")) {
              wx.showToast({ title: "支付已取消", icon: "none" });
            } else {
              wx.showToast({ title: "支付失败", icon: "none" });
            }
          },
        });
      })
      .catch((err) => {
        wx.hideLoading();
        console.error("重新预下单异常:", err);
        wx.showToast({ title: "网络异常", icon: "none" });
      });
  },

  // 获取微信openid
  getWechatOpenId: function (callback) {
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
                if (callback) callback();
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

  // 检查支付状态
  checkPaymentStatus: function () {
    const orderId = this.data.orderId;
    wx.showLoading({ title: "确认支付状态...", mask: true });

    app
      .callCloudApi(`/api/payment/query/${orderId}`, "GET")
      .then((resp) => {
        wx.hideLoading();
        if (resp && resp.success && resp.data) {
          const status = resp.data.status;
          if (status === "paid") {
            wx.showToast({ title: "支付确认成功", icon: "success" });
            setTimeout(() => {
              this.loadOrderDetail();
            }, 1000);
          } else {
            // 如果状态还未更新，可能需要等待回调，继续轮询
            this.pollPaymentStatus(1);
          }
        } else {
          console.error("查询支付状态失败:", resp);
          // fallback到重新加载订单详情
          this.loadOrderDetail();
        }
      })
      .catch((err) => {
        wx.hideLoading();
        console.error("查询支付状态异常:", err);
        // fallback到重新加载订单详情
        this.loadOrderDetail();
      });
  },

  // 轮询支付状态（最多轮询5次）
  pollPaymentStatus: function (attempts) {
    if (attempts > 5) {
      console.log("轮询支付状态超时，停止轮询");
      this.loadOrderDetail();
      return;
    }

    const orderId = this.data.orderId;
    setTimeout(() => {
      app
        .callCloudApi(`/api/payment/query/${orderId}`, "GET")
        .then((resp) => {
          if (resp && resp.success && resp.data) {
            const status = resp.data.status;
            if (status === "paid") {
              wx.showToast({ title: "支付确认成功", icon: "success" });
              setTimeout(() => {
                this.loadOrderDetail();
              }, 1000);
            } else {
              // 继续轮询
              this.pollPaymentStatus(attempts + 1);
            }
          } else {
            this.loadOrderDetail();
          }
        })
        .catch((err) => {
          console.error(`第${attempts}次轮询支付状态失败:`, err);
          this.loadOrderDetail();
        });
    }, 2000); // 每2秒轮询一次
  },

  // 加载订单详情
  loadOrderDetail: function () {
    this.setData({
      loading: true,
      hasError: false,
      errorMsg: "",
    });

    const orderId = this.data.orderId;

    // 获取订单详情
    app
      .callCloudApi(`/api/orders/${orderId}`, "GET")
      .then((data) => {
        console.log("订单详情数据:", data);
        if (data.success) {
          const order = data.data;

          // 设置订单基本信息并处理金额
          const formattedOrder = {
            ...order,
            total_amount: parseFloat(order.total_amount).toFixed(2) || "0.00",
          };

          this.setData({
            order: formattedOrder,
            statusText: this.getStatusText(order.status),
            paymentStatusText: this.getPaymentStatusText(order.payment_status),
            createdAt: this.formatDate(order.created_at),
            loading: false,
          });

          // 加载订单商品
          this.loadOrderItems();

          // 加载订单日志
          this.loadOrderLogs();
        } else {
          this.setData({
            loading: false,
            hasError: true,
            errorMsg: data.message || "获取订单详情失败",
          });
        }
      })
      .catch((err) => {
        console.error("获取订单详情失败:", err);
        this.setData({
          loading: false,
          hasError: true,
          errorMsg: "网络错误，请稍后重试",
        });
      });
  },

  // 加载订单商品
  loadOrderItems: function () {
    const orderId = this.data.orderId;

    app
      .callCloudApi(`/api/orders/${orderId}/items`, "GET")
      .then((data) => {
        console.log("订单商品数据:", data);
        if (data.success) {
          // 处理商品数据
          const items = data.items || [];

          // 获取商品名称并处理金额
          const processedItems = items.map((item) => {
            return {
              ...item,
              productName: item.product_name || `商品#${item.product_id}`,
              unit_price: parseFloat(item.unit_price).toFixed(2) || "0.00",
              subtotal: parseFloat(item.subtotal).toFixed(2) || "0.00",
            };
          });

          this.setData({
            orderItems: processedItems,
          });
        }
      })
      .catch((err) => {
        console.error("获取订单商品失败:", err);
      });
  },

  // 加载订单日志
  loadOrderLogs: function () {
    const orderId = this.data.orderId;

    app
      .callCloudApi(`/api/orders/${orderId}/logs`, "GET")
      .then((data) => {
        console.log("订单日志数据:", data);
        if (data.success) {
          this.setData({
            orderLogs: data.items || [],
          });
        }
      })
      .catch((err) => {
        console.error("获取订单日志失败:", err);
      });
  },

  // 刷新数据
  refreshData: function () {
    this.loadOrderDetail();
  },

  // 返回上一页
  navigateBack: function () {
    wx.navigateBack();
  },

  // 确认订单
  confirmOrder: function () {
    this.updateOrderStatus("approved", "确认订单");
  },

  // 开始处理订单
  processOrder: function () {
    this.updateOrderStatus("processing", "开始处理");
  },

  // 完成订单
  completeOrder: function () {
    this.updateOrderStatus("completed", "完成订单");
  },

  // 更新订单状态
  updateOrderStatus: function (status, action) {
    const orderId = this.data.orderId;

    wx.showLoading({
      title: "处理中...",
      mask: true,
    });

    app
      .callCloudApi(`/api/orders/${orderId}/status`, "PUT", {
        status: status,
        action: action,
        remarks: `${action}操作`,
      })
      .then((data) => {
        console.log("更新订单状态响应:", data);
        wx.hideLoading();

        if (data.success) {
          wx.showToast({
            title: "操作成功",
            icon: "success",
          });

          // 重新加载订单详情
          setTimeout(() => {
            this.loadOrderDetail();
          }, 1000);
        } else {
          wx.showToast({
            title: data.message || "操作失败",
            icon: "none",
          });
        }
      })
      .catch((err) => {
        console.error("更新订单状态失败:", err);
        wx.hideLoading();
        wx.showToast({
          title: "网络错误",
          icon: "none",
        });
      });
  },

  // 获取状态文本
  getStatusText: function (status) {
    const statusMap = {
      pending: "待处理",
      approved: "已批准",
      rejected: "已拒绝",
      processing: "处理中",
      completed: "已完成",
    };
    return statusMap[status] || "未知状态";
  },

  // 获取支付状态文本
  getPaymentStatusText: function (paymentStatus) {
    const statusMap = {
      unpaid: "待支付",
      paying: "支付中",
      paid: "已支付",
      failed: "支付失败",
      refunded: "已退款",
    };
    return statusMap[paymentStatus] || "未知";
  },

  // 格式化日期
  formatDate: function (dateString) {
    if (!dateString) return "";
    const date = new Date(dateString);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(date.getDate()).padStart(2, "0")} ${String(
      date.getHours()
    ).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  },
});
