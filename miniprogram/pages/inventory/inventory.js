// inventory.js
const app = getApp();

Page({
  data: {
    loading: true,
    inventories: [],
    checkedProducts: {}, // 用于存储盘点结果
    showResult: false, // 是否显示盘点结果
    submitting: false, // 是否正在提交
    exporting: false, // 是否正在导出
    allProducts: [], // 存储所有商品种类
    loadingImages: {}, // 跟踪图片加载状态
    imageLoaded: {}, // 图片加载成功标记
    showExportOptions: false, // 显示导出选项
  },

  onLoad: function () {
    if (app.globalData.isLoggedIn) {
      // 先获取所有商品，再获取库存
      this.fetchAllProducts();
    } else {
      app.loginCallback = () => {
        this.fetchAllProducts();
      };
    }
  },

  onShow: function () {
    if (app.globalData.isLoggedIn && !this.data.showResult) {
      // 切换回页面时检查是否需要重新加载
      const lastFetch = wx.getStorageSync("lastInventoryFetch");
      const now = Date.now();

      // 如果距离上次加载超过5分钟，重新加载
      if (!lastFetch || now - lastFetch > 5 * 60 * 1000) {
        this.fetchAllProducts();
      }
    }
  },

  // 获取图片URL的辅助函数
  getImageUrl: function (imagePath) {
    return app.getImageUrl(imagePath);
  },

  // 处理图片加载错误
  handleImageError: function (e) {
    const index = e.currentTarget.dataset.index;
    const inventories = this.data.inventories;

    if (!inventories[index] || !inventories[index].product) {
      console.error(`数据索引错误: ${index}`);
      return;
    }

    const product = inventories[index].product;
    const productName = product.name || "未知商品";
    const productImage = product.image || "";

    console.log(
      `商品[${productName}]图片[${productImage}]加载失败，使用默认图片`
    );

    // 使用默认图片
    const defaultImageUrl = `/api/image/no-photo.jpg`;
    console.log(`使用默认图片: ${defaultImageUrl}`);

    // 修改数据，使用默认图片
    inventories[index].product.imageUrl = defaultImageUrl;

    // 更新图片加载状态
    const imageLoaded = this.data.imageLoaded;
    imageLoaded[index] = true;

    this.setData({
      inventories,
      imageLoaded,
    });
  },

  // 处理图片加载成功
  handleImageLoad: function (e) {
    const index = e.currentTarget.dataset.index;

    // 更新图片加载状态
    const imageLoaded = this.data.imageLoaded;
    imageLoaded[index] = true;

    this.setData({ imageLoaded });
  },

  // 处理盘点商品图片错误
  handleProductImageError: function (e) {
    const id = e.currentTarget.dataset.id;
    const checkedProducts = this.data.checkedProducts;

    if (checkedProducts[id]) {
      const productName = checkedProducts[id].name || "未知商品";
      const productImage = checkedProducts[id].image || "";

      console.log(
        `盘点商品[${productName}]图片[${productImage}]加载失败，使用默认图片`
      );

      // 使用默认图片
      const defaultImageUrl = `/api/image/no-photo.jpg`;
      checkedProducts[id].imageUrl = defaultImageUrl;

      // 更新加载状态
      const loadingImages = this.data.loadingImages;
      loadingImages[id] = false;

      this.setData({
        checkedProducts,
        loadingImages,
      });
    }
  },

  // 处理盘点商品图片加载成功
  handleProductImageLoad: function (e) {
    const id = e.currentTarget.dataset.id;

    // 更新加载状态
    const loadingImages = this.data.loadingImages;
    loadingImages[id] = false;

    this.setData({ loadingImages });
  },

  // 获取所有商品
  fetchAllProducts: function () {
    console.log("开始获取所有商品列表...");

    // 使用云托管调用API
    app
      .callCloudApi("/api/products", "GET")
      .then((data) => {
        console.log("获取商品列表成功:", data);
        if (data.success) {
          this.setData({
            allProducts: data.items || [],
          });
          // 获取完商品后再获取库存
          this.fetchInventory();
        } else {
          wx.showToast({
            title: data.message || "获取商品失败",
            icon: "none",
          });
          this.setData({ loading: false });
        }
      })
      .catch((err) => {
        console.error("获取商品列表失败:", err);
        wx.showToast({
          title: "获取商品失败，请重试",
          icon: "none",
        });
        this.setData({ loading: false });
      });
  },

  // 获取库存数据
  fetchInventory: function () {
    if (!app.globalData.isLoggedIn || !app.globalData.store) {
      console.error("未登录或没有门店信息");
      this.setData({ loading: false });
      return;
    }

    console.log("开始获取库存数据...");
    this.setData({ loading: true });

    const storeId = app.globalData.store.id;

    // 使用云托管调用库存API
    app
      .callCloudApi(`/miniprogram/inventory?storeId=${storeId}`, "GET")
      .then((data) => {
        console.log("获取库存成功:", data);
        if (data.success) {
          // 处理库存数据
          const inventories = (data.data || []).map((item) => {
            // 确保product字段存在
            if (!item.product) {
              item.product = {
                id: item.product_id,
                name: item.product_name,
                code: item.product_code,
                unit: item.unit,
                image: item.image,
                price: parseFloat(item.price) || 0,
              };
            }

            // 直接使用产品图片，不再使用SVG占位图
            item.product.imageUrl = app.getImageUrl(item.image);

            // 确保last_checked_at存在
            item.lastCheckedAt =
              item.last_checked_at || item.formatted_checked_at;

            return item;
          });

          // 初始化图片加载状态
          const imageLoaded = {};
          inventories.forEach((_, index) => {
            imageLoaded[index] = false; // 设置为false，等待图片加载完成
          });

          // 更新数据
          this.setData({
            inventories,
            imageLoaded,
            loading: false,
          });

          // 记录本次获取时间
          wx.setStorageSync("lastInventoryFetch", Date.now());

          console.log("库存数据处理完成:", inventories);
        } else {
          wx.showToast({
            title: data.message || "获取库存失败",
            icon: "none",
          });
          this.setData({ loading: false });
        }
      })
      .catch((err) => {
        console.error("获取库存失败:", err);
        wx.showToast({
          title: "获取库存失败，请重试",
          icon: "none",
        });
        this.setData({ loading: false });
      });
  },

  // 更新盘点数量
  updateQuantity: function (e) {
    const { productId, action } = e.currentTarget.dataset;
    const checkedProducts = this.data.checkedProducts;

    if (action === "increase") {
      checkedProducts[productId].newQuantity++;
    } else if (
      action === "decrease" &&
      checkedProducts[productId].newQuantity > 0
    ) {
      checkedProducts[productId].newQuantity--;
    }

    this.setData({ checkedProducts });
  },

  // 手动输入数量
  inputQuantity: function (e) {
    const { productId } = e.currentTarget.dataset;
    const value = parseInt(e.detail.value);
    const checkedProducts = this.data.checkedProducts;

    if (!isNaN(value) && value >= 0) {
      checkedProducts[productId].newQuantity = value;
      this.setData({ checkedProducts });
    }
  },

  // 开始盘点 - 使用惰性加载方式
  startCheck: function () {
    // 显示loading，避免界面卡顿
    wx.showLoading({
      title: "准备盘点数据...",
    });

    console.log("开始盘点，库存数据:", this.data.inventories);

    // 检查库存数据是否存在
    if (!this.data.inventories || this.data.inventories.length === 0) {
      wx.hideLoading();
      wx.showToast({
        title: "暂无商品数据",
        icon: "none",
      });
      return;
    }

    // 初始化盘点产品数据
    const checkedProducts = {};
    const loadingImages = {};

    // 从库存数据中填充盘点数据
    this.data.inventories.forEach((item) => {
      // 打印调试信息，查看item的结构
      console.log("处理库存项目:", item);

      // 获取产品ID和必要数据
      const productId = item.product_id;
      const product = item.product || {};
      const productName = product.name || item.product_name || "";
      const productImage = product.image || item.image || "";

      // 获取产品图片URL
      const imageUrl = app.getImageUrl(productImage);

      checkedProducts[productId] = {
        id: productId,
        name: productName,
        code: product.code || item.product_code,
        unit: product.unit || item.unit,
        price: parseFloat(product.price || item.price) || 0,
        image: productImage,
        imageUrl: imageUrl,
        currentQuantity: parseInt(item.quantity) || 0,
        newQuantity: parseInt(item.quantity) || 0, // 初始值与当前库存相同
      };
      loadingImages[productId] = false; // 设置图片加载状态
    });

    // 使用setTimeout延迟处理，防止界面卡顿
    setTimeout(() => {
      console.log(
        "准备设置盘点商品数据:",
        Object.keys(checkedProducts).length,
        "个商品"
      );

      this.setData(
        {
          showResult: true,
          checkedProducts: checkedProducts,
          loadingImages: loadingImages,
        },
        () => {
          wx.hideLoading();
          console.log(
            "盘点界面已显示，商品数:",
            Object.keys(checkedProducts).length
          );
        }
      );
    }, 100);
  },

  // 取消盘点
  cancelCheck: function () {
    wx.showModal({
      title: "取消盘点",
      content: "确定要取消本次盘点吗？",
      success: (res) => {
        if (res.confirm) {
          this.setData({
            showResult: false,
            loading: true,
          });
          this.fetchAllProducts(); // 重新获取所有数据
        }
      },
    });
  },

  // 提交盘点结果
  submitCheckResult: function () {
    // 收集盘点结果
    const checkedProducts = this.data.checkedProducts;
    const items = [];

    // 确认有变更需要提交
    for (const productId in checkedProducts) {
      const product = checkedProducts[productId];
      // 只提交有变更的商品
      if (product.currentQuantity !== product.newQuantity) {
        items.push({
          productId: parseInt(productId),
          quantity: product.newQuantity,
        });
      }
    }

    // 如果没有变更，提示用户
    if (items.length === 0) {
      wx.showToast({
        title: "没有变更需要提交",
        icon: "none",
      });
      return;
    }

    // 设置提交中状态
    this.setData({ submitting: true });

    // 显示加载提示
    wx.showLoading({
      title: "提交中...",
      mask: true,
    });

    // 构建请求数据
    const requestData = {
      storeId: app.globalData.store.id,
      items: items,
    };

    console.log("提交盘点数据:", requestData);

    // 使用云托管调用方式提交
    app
      .callCloudApi("/miniprogram/inventory/check", "POST", requestData)
      .then((data) => {
        wx.hideLoading();
        this.setData({ submitting: false });

        if (data.success) {
          wx.showToast({
            title: "提交成功",
            icon: "success",
          });

          // 关闭结果页，重新获取库存
          this.setData({ showResult: false });
          this.fetchAllProducts();
        } else {
          wx.showToast({
            title: data.message || "提交失败",
            icon: "none",
          });
        }
      })
      .catch((err) => {
        wx.hideLoading();
        console.error("提交盘点数据失败:", err);

        this.setData({ submitting: false });

        wx.showToast({
          title: "网络错误，请重试",
          icon: "none",
        });
      });
  },

  // 导出库存
  exportInventory: function () {
    // 显示导出选项
    const that = this;
    wx.showActionSheet({
      itemList: ["导出为文件", "复制为文本"],
      success: function (res) {
        if (res.tapIndex === 0) {
          // 导出为文件
          that.exportAsFile();
        } else if (res.tapIndex === 1) {
          // 复制为文本
          that.exportAsText();
        }
      },
      fail: function (res) {
        console.log(res.errMsg);
      },
    });
  },

  // 导出库存为文件
  exportAsFile: function () {
    const storeId = app.globalData.store ? app.globalData.store.id : "";
    const fileUtils = require("../../utils/fileUtils.js");
    const that = this; // 保存this引用

    if (!storeId) {
      wx.showToast({
        title: "获取门店信息失败",
        icon: "none",
      });
      return;
    }

    this.setData({ exporting: true });

    wx.showLoading({
      title: "准备导出文件...",
      mask: true,
    });

    // 获取当前月份
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
      2,
      "0"
    )}`;

    console.log("开始导出库存数据，门店ID:", storeId);

    // 使用/api/inventories/export-base64路径
    app
      .callCloudApi("/api/inventories/export-base64", "GET", {
        storeId: storeId,
        month: month,
      })
      .then(async (res) => {
        wx.hideLoading();

        if (res.success) {
          try {
            const { filename, base64Content } = res.data;
            console.log("成功获取导出数据，文件名:", filename);

            // 将Base64内容转换为临时文件
            const tempFilePath = await fileUtils.base64ToTempFile(
              base64Content,
              filename
            );
            console.log("成功创建临时文件:", tempFilePath);

            try {
              // 使用改进的方法保存文件
              const savedFilePath = await fileUtils.saveFileToLocal(
                tempFilePath
              );
              console.log("成功保存文件到:", savedFilePath);

              // 尝试打开文件
              wx.openDocument({
                filePath: savedFilePath,
                showMenu: true,
                fileType: "xls",
                success: function () {
                  console.log("成功打开保存的文件");
                  wx.showToast({
                    title: "导出成功",
                    icon: "success",
                  });
                },
                fail: function (openErr) {
                  console.error("打开保存的文件失败:", openErr);

                  // 如果文件无法打开，但已经保存成功，提示用户
                  wx.showModal({
                    title: "导出成功",
                    content: `文件已保存到: ${savedFilePath}，但无法直接打开。请使用其他应用打开该Excel文件。`,
                    showCancel: false,
                  });
                },
              });
            } catch (saveError) {
              console.error("保存文件失败:", saveError);

              // 保存失败，尝试直接打开临时文件
              try {
                wx.openDocument({
                  filePath: tempFilePath,
                  showMenu: true,
                  fileType: "xls",
                  success: function () {
                    console.log("成功打开临时文件");
                    wx.showToast({
                      title: "导出成功",
                      icon: "success",
                    });
                  },
                  fail: function (openErr) {
                    console.error("打开临时文件失败:", openErr);

                    // 如果临时文件也无法打开，建议使用文本方式
                    wx.showModal({
                      title: "导出失败",
                      content: "无法保存或打开文件，是否尝试文本方式导出?",
                      confirmText: "文本导出",
                      success: (modalRes) => {
                        if (modalRes.confirm) {
                          that.exportAsText();
                        }
                      },
                    });
                  },
                });
              } catch (openError) {
                console.error("尝试打开临时文件失败:", openError);
                // 所有方式都失败，提示使用文本导出
                wx.showModal({
                  title: "导出失败",
                  content: "无法处理文件，是否尝试文本方式导出?",
                  confirmText: "文本导出",
                  success: (modalRes) => {
                    if (modalRes.confirm) {
                      that.exportAsText();
                    }
                  },
                });
              }
            }
          } catch (error) {
            console.error("处理文件失败:", error);
            wx.showModal({
              title: "导出失败",
              content: "文件处理出错，是否尝试文本方式导出?",
              confirmText: "文本导出",
              success: (modalRes) => {
                if (modalRes.confirm) {
                  that.exportAsText();
                }
              },
            });
          }
        } else {
          console.error("导出失败:", res);
          wx.showToast({
            title: res.message || "导出失败",
            icon: "none",
          });
        }
      })
      .catch((err) => {
        wx.hideLoading();
        console.error("导出请求失败:", err);

        wx.showToast({
          title: "网络错误，请重试",
          icon: "none",
        });
      })
      .finally(() => {
        this.setData({ exporting: false });
      });
  },

  // 显示导出选项
  showExportOptions: function () {
    this.setData({
      showExportOptions: true,
    });
  },

  // 隐藏导出选项
  hideExportOptions: function () {
    this.setData({
      showExportOptions: false,
    });
  },

  // 使用复制文本方式导出
  exportAsText: function () {
    const storeId = app.globalData.store ? app.globalData.store.id : "";

    if (!storeId) {
      wx.showToast({
        title: "获取门店信息失败",
        icon: "none",
      });
      return;
    }

    this.setData({ exporting: true });

    wx.showLoading({
      title: "准备导出文本...",
      mask: true,
    });

    // 获取当前月份
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
      2,
      "0"
    )}`;

    // 使用云函数获取库存数据
    app
      .callCloudApi(`/miniprogram/inventory?storeId=${storeId}`, "GET")
      .then((data) => {
        wx.hideLoading();

        if (data.success) {
          try {
            // 格式化为CSV文本
            let csvText =
              "序号,商品编码,商品名称,单位,单价,库存数量,库存金额\n";

            // 添加数据行
            data.data.forEach((item, index) => {
              const price = parseFloat(item.price) || 0;
              const quantity = parseInt(item.quantity) || 0;
              const totalValue = price * quantity;

              csvText += `${index + 1},${item.product_code || ""},${
                item.product_name || ""
              },${item.unit || "个"},${price.toFixed(
                2
              )},${quantity},${totalValue.toFixed(2)}\n`;
            });

            // 复制到剪贴板
            wx.setClipboardData({
              data: csvText,
              success: () => {
                wx.showToast({
                  title: "库存数据已复制",
                  icon: "success",
                });
                wx.showModal({
                  title: "导出成功",
                  content:
                    "库存数据已复制到剪贴板，您可以粘贴到Excel或记事本中保存。",
                  showCancel: false,
                });
                this.hideExportOptions();
              },
              fail: (err) => {
                console.error("复制到剪贴板失败:", err);
                wx.showToast({
                  title: "导出失败",
                  icon: "none",
                });
              },
            });
          } catch (error) {
            console.error("处理文本数据失败:", error);
            wx.showToast({
              title: "处理数据失败",
              icon: "none",
            });
          }
        } else {
          console.error("获取库存数据失败:", data);
          wx.showToast({
            title: data.message || "获取库存数据失败",
            icon: "none",
          });
        }
      })
      .catch((err) => {
        wx.hideLoading();
        console.error("导出请求失败:", err);
        wx.showToast({
          title: "网络错误，请重试",
          icon: "none",
        });
      })
      .finally(() => {
        this.setData({ exporting: false });
      });
  },
});
