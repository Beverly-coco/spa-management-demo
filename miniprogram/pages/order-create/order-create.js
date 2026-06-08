// pages/order-create/order-create.js
const app = getApp();

Page({
  data: {
    formData: {
      title: "",
      description: "",
      products: [],
    },
    productList: [], // 产品列表
    totalQuantity: 0,
    totalAmount: 0,
    submitting: false,
    imageLoaded: {}, // 图片加载成功标记
  },

  onLoad: function () {
    // 自动生成订单标题
    this.generateOrderTitle();
    // 加载产品列表
    this.loadProductList().then(() => {
      // 初始化一个空商品
      this.addProduct();
    });
  },

  // 获取图片URL的辅助函数
  getImageUrl: function (imagePath) {
    return app.getImageUrl(imagePath);
  },

  // 处理选中商品的图片加载错误
  handleImageError: function (e) {
    const index = e.currentTarget.dataset.index;
    console.log(`商品 ${index} 图片加载失败，使用默认图片`);

    // 使用默认图片
    const defaultImageUrl = this.getImageUrl("no-photo.jpg");

    this.setData({
      [`formData.products[${index}].productImageUrl`]: defaultImageUrl,
      [`imageLoaded[${index}]`]: true,
    });
  },

  // 处理选中商品的图片加载成功
  handleImageLoad: function (e) {
    const index = e.currentTarget.dataset.index;
    this.setData({
      [`imageLoaded[${index}]`]: true,
    });
  },

  // 处理下拉列表中的图片加载错误
  handleDropdownImageError: function (e) {
    const index = e.currentTarget.dataset.index;
    const productId = e.currentTarget.dataset.productId;
    console.log(`下拉列表商品 ${productId} 图片加载失败，使用默认图片`);

    // 使用默认图片
    const defaultImageUrl = this.getImageUrl("no-photo.jpg");

    // 更新产品列表中的图片URL
    const productList = this.data.productList;
    const productIndex = productList.findIndex((p) => p.id === productId);
    if (productIndex !== -1) {
      productList[productIndex].imageUrl = defaultImageUrl;
      this.setData({
        productList: productList,
      });
    }
  },

  // 处理下拉列表中的图片加载成功
  handleDropdownImageLoad: function (e) {
    // 图片加载成功，无需特殊处理
  },

  // 自动生成订单标题
  generateOrderTitle: function () {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");

    // 获取门店编号
    const storeCode = app.globalData.store
      ? app.globalData.store.code || app.globalData.store.id
      : "STORE";

    // 生成标题格式：门店编号-年月日时分
    const title = `${storeCode}-${year}${month}${day}${hours}${minutes}`;

    this.setData({
      "formData.title": title,
    });
  },

  // 加载产品列表
  loadProductList: function () {
    return new Promise((resolve, reject) => {
      wx.showLoading({
        title: "加载产品...",
        mask: true,
      });

      app
        .callCloudApi("/api/products", "GET", { limit: 100 })
        .then((data) => {
          console.log("产品列表数据:", data);
          wx.hideLoading();

          if (data.success) {
            // 格式化价格显示并处理图片URL
            const products = data.items.map((item) => {
              return {
                ...item,
                price: parseFloat(item.price || 0),
                imageUrl: this.getImageUrl(item.image || item.image_url),
              };
            });

            this.setData({
              productList: products || [],
            });
            resolve(products);
          } else {
            wx.showToast({
              title: "加载产品列表失败",
              icon: "none",
            });
            reject(new Error("加载产品列表失败"));
          }
        })
        .catch((err) => {
          console.error("加载产品列表失败:", err);
          wx.hideLoading();
          wx.showToast({
            title: "网络错误",
            icon: "none",
          });
          reject(err);
        });
    });
  },

  // 商品信息变化
  onProductChange: function (e) {
    const index = e.currentTarget.dataset.index;
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;

    this.setData({
      [`formData.products[${index}].${field}`]: value,
    });

    // 计算小计
    this.calculateSubtotal(index);
    // 计算总计
    this.calculateTotal();
  },

  // 添加商品
  addProduct: function () {
    const products = this.data.formData.products;
    products.push({
      productIndex: -1,
      productName: "",
      productId: null,
      productImage: "",
      productImageUrl: "",
      quantity: "",
      price: 0,
      subtotal: 0,
      showDropdown: false,
      searchKeyword: "",
      filteredProducts: this.data.productList || [],
    });

    this.setData({
      "formData.products": products,
    });

    // 显示添加成功提示
    wx.showToast({
      title: "商品已添加",
      icon: "success",
      duration: 1500,
    });
  },

  // 点击选择器输入框
  onSelectorFocus: function (e) {
    console.log("onSelectorFocus 被调用", e.currentTarget.dataset);
    const index = parseInt(e.currentTarget.dataset.index);
    const products = [...this.data.formData.products]; // 创建副本以避免直接修改

    // 关闭所有其他下拉框，只打开/关闭当前的
    products.forEach((product, i) => {
      if (i === index) {
        product.showDropdown = !product.showDropdown;
        // 重置搜索和过滤
        if (product.showDropdown) {
          product.searchKeyword = "";
          product.filteredProducts = [...this.data.productList]; // 创建副本
        }
      } else {
        product.showDropdown = false;
      }
    });

    this.setData({
      "formData.products": products,
    });
  },

  // 关闭下拉框
  onCloseDropdown: function (e) {
    console.log("onCloseDropdown 被调用", e.currentTarget.dataset);
    const index = parseInt(e.currentTarget.dataset.index);

    if (index >= 0 && index < this.data.formData.products.length) {
      this.setData({
        [`formData.products[${index}].showDropdown`]: false,
      });
    }
  },

  // 阻止事件冒泡
  stopPropagation: function () {
    // 空函数，仅用于阻止事件冒泡
  },

  // 搜索输入
  onSearchInput: function (e) {
    const index = parseInt(e.currentTarget.dataset.index);
    const keyword = e.detail.value.toLowerCase();

    // 过滤产品列表
    const filteredProducts = this.data.productList.filter((product) => {
      return product.name.toLowerCase().includes(keyword);
    });

    // 只更新当前商品的搜索关键词和过滤结果
    if (index >= 0 && index < this.data.formData.products.length) {
      this.setData({
        [`formData.products[${index}].searchKeyword`]: keyword,
        [`formData.products[${index}].filteredProducts`]: filteredProducts,
      });
    }
  },

  // 选择产品
  onSelectProduct: function (e) {
    console.log("onSelectProduct 被调用", e.currentTarget.dataset);
    const index = parseInt(e.currentTarget.dataset.index);
    const product = e.currentTarget.dataset.product;

    if (product && index >= 0) {
      const products = this.data.formData.products;

      // 防止重复触发和越界
      if (!products[index]) {
        console.error("商品索引越界", index, products.length);
        return;
      }

      // 更新当前商品信息
      products[index] = {
        ...products[index],
        productId: product.id,
        productName: product.name,
        productImage: product.image || product.image_url || "",
        productImageUrl:
          product.imageUrl ||
          this.getImageUrl(product.image || product.image_url),
        price: product.price,
        showDropdown: false,
        searchKeyword: "",
      };

      this.setData(
        {
          "formData.products": products,
        },
        () => {
          // 计算小计
          this.calculateSubtotal(index);
          // 计算总计
          this.calculateTotal();
        }
      );
    }
  },

  // 删除商品
  removeProduct: function (e) {
    const index = e.currentTarget.dataset.index;
    const products = this.data.formData.products;

    if (products.length > 1) {
      products.splice(index, 1);
      this.setData({
        "formData.products": products,
      });
      this.calculateTotal();
    } else {
      wx.showToast({
        title: "至少需要一个商品",
        icon: "none",
      });
    }
  },

  // 计算商品小计
  calculateSubtotal: function (index) {
    const product = this.data.formData.products[index];
    const quantity = parseFloat(product.quantity) || 0;
    const price = parseFloat(product.price) || 0;
    const subtotal = quantity * price;

    this.setData({
      [`formData.products[${index}].subtotal`]: subtotal,
    });
  },

  // 计算订单总计
  calculateTotal: function () {
    const products = this.data.formData.products;
    let totalQuantity = 0;
    let totalAmount = 0;

    products.forEach((product) => {
      const quantity = parseFloat(product.quantity) || 0;
      const price = parseFloat(product.price) || 0;
      totalQuantity += quantity;
      totalAmount += quantity * price;
    });

    this.setData({
      totalQuantity: totalQuantity,
      totalAmount: totalAmount.toFixed(2),
    });
  },

  // 提交订单
  submitOrder: function (e) {
    if (!app.globalData.store || !app.globalData.store.id) {
      wx.showToast({
        title: "请先登录",
        icon: "none",
      });
      return;
    }

    // 验证表单
    if (!this.validateForm()) {
      return;
    }

    this.setData({ submitting: true });

    const orderData = {
      storeId: app.globalData.store.id,
      title: this.data.formData.title,
      description: this.data.formData.description,
      totalAmount: parseFloat(this.data.totalAmount),
      products: this.data.formData.products
        .filter(
          (product) =>
            product.productId && product.quantity && product.quantity > 0
        )
        .map((product) => ({
          productId: product.productId,
          name: product.productName,
          quantity: parseFloat(product.quantity),
          price: parseFloat(product.price),
          subtotal: parseFloat(product.subtotal),
        })),
    };

    console.log("提交订单数据:", orderData);

    app
      .callCloudApi("/api/orders", "POST", orderData)
      .then((data) => {
        console.log("订单创建响应:", data);
        if (data.success) {
          wx.showToast({
            title: "订单创建成功",
            icon: "success",
          });

          // 返回订单列表页
          setTimeout(() => {
            wx.navigateBack();
          }, 1500);
        } else {
          wx.showToast({
            title: data.message || "创建失败",
            icon: "none",
          });
        }
      })
      .catch((err) => {
        console.error("创建订单失败:", err);
        wx.showToast({
          title: "网络错误",
          icon: "none",
        });
      })
      .finally(() => {
        this.setData({ submitting: false });
      });
  },

  // 验证表单
  validateForm: function () {
    const { title, products } = this.data.formData;

    if (!title.trim()) {
      wx.showToast({
        title: "请输入订单标题",
        icon: "none",
      });
      return false;
    }

    const validProducts = products.filter(
      (product) => product.productId && product.quantity && product.quantity > 0
    );

    if (validProducts.length === 0) {
      wx.showToast({
        title: "请至少添加一个商品",
        icon: "none",
      });
      return false;
    }

    return true;
  },

  // 取消创建
  cancelOrder: function () {
    wx.showModal({
      title: "确认取消",
      content: "确定要取消创建订单吗？",
      success: (res) => {
        if (res.confirm) {
          wx.navigateBack();
        }
      },
    });
  },
});
