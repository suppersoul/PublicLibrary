// app.js
App({
  globalData: {
    userInfo: null,
    token: null,
    baseUrl: 'http://localhost:3000/api',
    systemInfo: null
  },

  onLaunch() {
    console.log('小程序启动');
    
    // 获取系统信息
    this.getSystemInfo();
    
    // 检查登录状态
    this.checkLoginStatus();
    
    // 获取用户信息
    this.getUserInfo();
  },

  onShow() {
    console.log('小程序显示');
  },

  onHide() {
    console.log('小程序隐藏');
  },

  // 获取系统信息
  getSystemInfo() {
    try {
      const systemInfo = wx.getSystemInfoSync();
      this.globalData.systemInfo = systemInfo;
      console.log('系统信息:', systemInfo);
    } catch (e) {
      console.error('获取系统信息失败:', e);
    }
  },

  // 检查登录状态
  checkLoginStatus() {
    try {
      const token = wx.getStorageSync('token');
      if (token) {
        this.globalData.token = token;
        console.log('已找到登录令牌');
      }
    } catch (e) {
      console.error('检查登录状态失败:', e);
    }
  },

  // 获取用户信息
  getUserInfo() {
    try {
      const userInfo = wx.getStorageSync('userInfo');
      if (userInfo) {
        this.globalData.userInfo = userInfo;
        console.log('已找到用户信息');
      }
    } catch (e) {
      console.error('获取用户信息失败:', e);
    }
  },

  // 保存登录信息
  saveLoginInfo(token, userInfo) {
    try {
      wx.setStorageSync('token', token);
      wx.setStorageSync('userInfo', userInfo);
      this.globalData.token = token;
      this.globalData.userInfo = userInfo;
      console.log('登录信息保存成功');
    } catch (e) {
      console.error('保存登录信息失败:', e);
    }
  },

  // 清除登录信息
  clearLoginInfo() {
    try {
      wx.removeStorageSync('token');
      wx.removeStorageSync('userInfo');
      this.globalData.token = null;
      this.globalData.userInfo = null;
      console.log('登录信息清除成功');
    } catch (e) {
      console.error('清除登录信息失败:', e);
    }
  },

  // 检查是否已登录
  isLoggedIn() {
    return !!this.globalData.token;
  },

  // 显示加载提示
  showLoading(title = '加载中...') {
    wx.showLoading({
      title: title,
      mask: true
    });
  },

  // 隐藏加载提示
  hideLoading() {
    wx.hideLoading();
  },

  // 显示成功提示
  showSuccess(title, duration = 1500) {
    wx.showToast({
      title: title,
      icon: 'success',
      duration: duration
    });
  },

  // 显示错误提示
  showError(title, duration = 2000) {
    wx.showToast({
      title: title,
      icon: 'error',
      duration: duration
    });
  },

  // 显示提示
  showToast(title, icon = 'none', duration = 2000) {
    wx.showToast({
      title: title,
      icon: icon,
      duration: duration
    });
  },

  // 显示确认对话框
  showConfirm(content, title = '提示') {
    return new Promise((resolve) => {
      wx.showModal({
        title: title,
        content: content,
        success: (res) => {
          resolve(res.confirm);
        }
      });
    });
  },

  // 网络请求封装
  request(options) {
    return new Promise((resolve, reject) => {
      const { url, method = 'GET', data = {}, header = {} } = options;
      
      // 添加认证头
      if (this.globalData.token) {
        header.Authorization = `Bearer ${this.globalData.token}`;
      }

      wx.request({
        url: `${this.globalData.baseUrl}${url}`,
        method: method,
        data: data,
        header: {
          'Content-Type': 'application/json',
          ...header
        },
        success: (res) => {
          if (res.statusCode === 200) {
            if (res.data.code === 200) {
              resolve(res.data);
            } else if (res.data.code === 401) {
              // 未授权，清除登录信息并跳转到登录页
              this.clearLoginInfo();
              wx.navigateTo({
                url: '/pages/login/login'
              });
              reject(new Error(res.data.error || '未授权'));
            } else {
              reject(new Error(res.data.error || '请求失败'));
            }
          } else {
            reject(new Error(`HTTP错误: ${res.statusCode}`));
          }
        },
        fail: (err) => {
          console.error('请求失败:', err);
          reject(new Error('网络请求失败'));
        }
      });
    });
  },

  // 获取商品列表
  getProducts(params = {}) {
    return this.request({
      url: '/products',
      method: 'GET',
      data: params
    });
  },

  // 获取商品详情
  getProductDetail(id) {
    return this.request({
      url: `/products/${id}`,
      method: 'GET'
    });
  },

  // 获取商品分类
  getCategories() {
    return this.request({
      url: '/products/categories/list',
      method: 'GET'
    });
  },

  // 获取热门商品
  getHotProducts() {
    return this.request({
      url: '/products/hot/list',
      method: 'GET'
    });
  },

  // 获取推荐商品
  getRecommendProducts() {
    return this.request({
      url: '/products/recommend/list',
      method: 'GET'
    });
  },

  // 获取购物车
  getCart() {
    return this.request({
      url: '/cart',
      method: 'GET'
    });
  },

  // 添加到购物车
  addToCart(productId, quantity) {
    return this.request({
      url: '/cart/add',
      method: 'POST',
      data: {
        product_id: productId,
        quantity: quantity
      }
    });
  },

  // 更新购物车
  updateCart(productId, quantity) {
    return this.request({
      url: '/cart/update',
      method: 'PUT',
      data: {
        product_id: productId,
        quantity: quantity
      }
    });
  },

  // 从购物车删除
  removeFromCart(productId) {
    return this.request({
      url: `/cart/remove/${productId}`,
      method: 'DELETE'
    });
  },

  // 获取购物车数量
  getCartCount() {
    return this.request({
      url: '/cart/count',
      method: 'GET'
    });
  },

  // 检查购物车
  checkCart() {
    return this.request({
      url: '/cart/check',
      method: 'POST'
    });
  },

  // 微信登录
  wechatLogin(code, userInfo) {
    return this.request({
      url: '/auth/wechat-login',
      method: 'POST',
      data: {
        code: code,
        userInfo: userInfo
      }
    });
  },

  // 获取用户信息
  getUserProfile() {
    return this.request({
      url: '/auth/me',
      method: 'GET'
    });
  },

  // 发送短信验证码
  sendSms(phone) {
    return this.request({
      url: '/auth/send-sms',
      method: 'POST',
      data: { phone }
    });
  },

  // 绑定手机号
  bindPhone(phone, code) {
    return this.request({
      url: '/auth/bind-phone',
      method: 'POST',
      data: { phone, code }
    });
  },

  // 用户登出
  logout() {
    return this.request({
      url: '/auth/logout',
      method: 'POST'
    }).finally(() => {
      this.clearLoginInfo();
    });
  }
});