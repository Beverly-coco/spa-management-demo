// 文件工具类

/**
 * 将Base64数据转换为临时文件
 * @param {string} base64Data - Base64编码的文件内容
 * @param {string} fileName - 文件名
 * @param {string} fileType - 文件MIME类型
 * @returns {Promise<string>} - 返回临时文件路径
 */
const base64ToTempFile = (
  base64Data,
  fileName,
  fileType = "application/msexcel"
) => {
  return new Promise((resolve, reject) => {
    try {
      // 1. 将Base64转为ArrayBuffer
      const buffer = wx.base64ToArrayBuffer(base64Data);

      // 2. 清理文件名，确保安全
      let safeFileName = fileName
        .replace(/[\\/:"*?<>|]/g, "_") // 替换Windows文件系统不允许的字符
        .replace(/\s+/g, "_"); // 替换空格为下划线

      // 将XLSX转换为XLS格式 (iOS更好地支持XLS)
      safeFileName = safeFileName.replace(/\.xlsx$/i, ".xls");

      // 如果文件名不以.xls结尾，添加后缀
      if (!safeFileName.toLowerCase().endsWith(".xls")) {
        safeFileName += ".xls";
      }

      // 添加时间戳，避免文件名冲突
      const timestamp = new Date().getTime();
      const finalFileName = `inventory_${timestamp}.xls`;

      // 3. 获取FileSystemManager实例
      const fs = wx.getFileSystemManager();

      // 4. 使用临时文件目录(wx.env.USER_DATA_PATH可能不可用)
      const tmpDir = `${wx.env.USER_DATA_PATH}`;
      console.log("临时目录:", tmpDir);

      // 创建临时文件路径
      const tempFilePath = `${tmpDir}/${finalFileName}`;

      // 直接写入临时文件
      fs.writeFile({
        filePath: tempFilePath,
        data: buffer,
        encoding: "binary",
        success: () => {
          console.log("临时文件创建成功:", tempFilePath);

          // 检查文件是否存在
          fs.access({
            path: tempFilePath,
            success: () => {
              console.log("临时文件存在，可以访问:", tempFilePath);
              resolve(tempFilePath);
            },
            fail: (err) => {
              console.error("临时文件无法访问:", err);
              reject(new Error(`临时文件创建后无法访问: ${err.errMsg}`));
            },
          });
        },
        fail: (err) => {
          console.error("写入临时文件失败:", err);
          reject(err);
        },
      });
    } catch (error) {
      console.error("Base64转换为文件失败:", error);
      reject(error);
    }
  });
};

/**
 * 保存文件到本地
 * @param {string} tempFilePath - 临时文件路径
 * @returns {Promise<string>} - 返回保存后的文件路径
 */
const saveFileToLocal = (tempFilePath) => {
  return new Promise((resolve, reject) => {
    try {
      const fs = wx.getFileSystemManager();

      // 生成保存路径(使用存储目录)
      const timestamp = new Date().getTime();
      const savedFilePath = `${wx.env.USER_DATA_PATH}/saved_inventory_${timestamp}.xls`;

      // 使用copyFile代替saveFile
      fs.copyFile({
        srcPath: tempFilePath,
        destPath: savedFilePath,
        success: () => {
          console.log("文件已保存:", savedFilePath);
          resolve(savedFilePath);
        },
        fail: (err) => {
          console.error("保存文件失败:", err);
          reject(err);
        },
      });
    } catch (error) {
      console.error("保存文件过程中出错:", error);
      reject(error);
    }
  });
};

module.exports = {
  base64ToTempFile,
  saveFileToLocal,
};
