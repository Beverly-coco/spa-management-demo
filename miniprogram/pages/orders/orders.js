// pages/orders/orders.js
const app = getApp();

Page({
  data: {
    orders: [],
    loading: true,
    statusOptions: [
      "全部状态",
      "待处理",
      "已批准",
      "已拒绝",
      "处理中",
      "已完成",
    ],
    statusIndex: 0,
    selectedMonth: "",
    currentPage: 1,
    hasMore: true,
  },

  onLoad: function () {
    this.loadOrders();
  },

  onShow: function () {
    // 每次显示页面时刷新数据
    this.loadOrders();
  },

  // 加载订单列表
  loadOrders: function () {
    if (!app.globalData.store || !app.globalData.store.id) {
      wx.showToast({
        title: "请先登录",
        icon: "none",
      });
      return;
    }

    this.setData({ loading: true });

    const params = {
      storeId: app.globalData.store.id,
      page: this.data.currentPage,
      limit: 20,
    };

    // 添加状态筛选
    if (this.data.statusIndex > 0) {
      const statusMap = [
        "",
        "pending",
        "approved",
        "rejected",
        "processing",
        "completed",
      ];
      params.status = statusMap[this.data.statusIndex];
    }

    // 添加月份筛选
    if (this.data.selectedMonth) {
      params.month = this.data.selectedMonth;
    }

    app
      .callCloudApi("/api/orders", "GET", params)
      .then((data) => {
        console.log("订单列表数据:", data);
        if (data.success) {
          const orders = data.items || [];
          const formattedOrders = orders.map((order) => ({
            ...order,
            statusText: this.getStatusText(order.status),
            createdAt: this.formatDate(order.created_at),
            orderNumber: order.order_number,
            title: order.remarks || "采购订单",
            totalAmount: parseFloat(order.total_amount).toFixed(2) || "0.00",
            itemCount: order.itemCount || 0,
          }));

          this.setData({
            orders:
              this.data.currentPage === 1
                ? formattedOrders
                : [...this.data.orders, ...formattedOrders],
            hasMore: orders.length === 20,
            loading: false,
          });
        } else {
          wx.showToast({
            title: data.message || "获取订单失败",
            icon: "none",
          });
          this.setData({ loading: false });
        }
      })
      .catch((err) => {
        console.error("获取订单列表失败:", err);
        wx.showToast({
          title: "网络错误",
          icon: "none",
        });
        this.setData({ loading: false });
      });
  },

  // 状态筛选变化
  onStatusChange: function (e) {
    this.setData({
      statusIndex: e.detail.value,
      currentPage: 1,
    });
    this.loadOrders();
  },

  // 月份筛选变化
  onMonthChange: function (e) {
    this.setData({
      selectedMonth: e.detail.value,
      currentPage: 1,
    });
    this.loadOrders();
  },

  // 创建新订单
  createOrder: function () {
    wx.navigateTo({
      url: "/pages/order-create/order-create",
    });
  },

  // 查看订单详情
  viewOrderDetail: function (e) {
    const orderId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/order-detail/order-detail?id=${orderId}`,
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

  // 格式化日期
  formatDate: function (dateString) {
    if (!dateString) return "";
    const date = new Date(dateString);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(date.getDate()).padStart(2, "0")}`;
  },

  // 下拉刷新
  onPullDownRefresh: function () {
    this.setData({ currentPage: 1 });
    this.loadOrders().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  // 上拉加载更多
  onReachBottom: function () {
    if (this.data.hasMore && !this.data.loading) {
      this.setData({
        currentPage: this.data.currentPage + 1,
      });
      this.loadOrders();
    }
  },
});
