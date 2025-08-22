// app.js
App({
  globalData: {
    userInfo: null,
    token: null,
    baseUrl: 'http://localhost:3000/api', // 开发环境API地址
    // baseUrl: 'https://your-domain.com/api', // 生产环境API地址
    version: '1.0.0'
  },

  onLaunch() {
    console.log('小程序启动');
    
    // 检查更新
    this.checkUpdate();
    
    // 获取本地存储的用户信息
    this.getLocalUserInfo();
    
    // 获取系统信息
    this.getSystemInfo();
  },

  onShow() {
    console.log('小程序显示');
  },

  onHide() {
    console.log('小程序隐藏');
  },

  onError(msg) {
    console.error('小程序错误:', msg);
  },

  // 检查小程序更新
  checkUpdate() {
    if (wx.canIUse('getUpdateManager')) {
      const updateManager = wx.getUpdateManager();
      
      updateManager.onCheckForUpdate((res) => {
        if (res.hasUpdate) {
          updateManager.onUpdateReady(() => {
            wx.showModal({
              title: '更新提示',
              content: '新版本已经准备好，是否重启应用？',
              success: (res) => {
                if (res.confirm) {
                  updateManager.applyUpdate();
                }
              }
            });
          });
          
          updateManager.onUpdateFailed(() => {
            wx.showModal({
              title: '更新失败',
              content: '新版本下载失败，请检查网络后重试',
              showCancel: false
            });
          });
        }
      });
    }
  },

  // 获取本地存储的用户信息
  getLocalUserInfo() {
    try {
      const token = wx.getStorageSync('token');
      const userInfo = wx.getStorageSync('userInfo');
      
      if (token && userInfo) {
        this.globalData.token = token;
        this.globalData.userInfo = userInfo;
        
        // 验证token是否有效
        this.validateToken();
      }
    } catch (e) {
      console.error('获取本地存储失败:', e);
    }
  },

  // 验证token有效性
  async validateToken() {
    try {
      const res = await wx.request({
        url: `${this.globalData.baseUrl}/auth/me`,
        method: 'GET',
        header: {
          'Authorization': `Bearer ${this.globalData.token}`
        }
      });

      if (res.statusCode !== 200) {
        // token无效，清除本地存储
        this.clearUserInfo();
      }
    } catch (error) {
      console.error('验证token失败:', error);
      this.clearUserInfo();
    }
  },

  // 清除用户信息
  clearUserInfo() {
    this.globalData.token = null;
    this.globalData.userInfo = null;
    
    try {
      wx.removeStorageSync('token');
      wx.removeStorageSync('userInfo');
    } catch (e) {
      console.error('清除本地存储失败:', e);
    }
  },

  // 获取系统信息
  getSystemInfo() {
    try {
      const systemInfo = wx.getSystemInfoSync();
      this.globalData.systemInfo = systemInfo;
      
      // 设置导航栏高度
      const menuButtonInfo = wx.getMenuButtonBoundingClientRect();
      this.globalData.navBarHeight = menuButtonInfo.height + (menuButtonInfo.top - systemInfo.statusBarHeight) * 2;
      
      console.log('系统信息:', systemInfo);
    } catch (e) {
      console.error('获取系统信息失败:', e);
    }
  },

  // 显示加载提示
  showLoading(title = '加载中...') {
    wx.showLoading({
      title,
      mask: true
    });
  },

  // 隐藏加载提示
  hideLoading() {
    wx.hideLoading();
  },

  // 显示提示信息
  showToast(title, icon = 'none', duration = 2000) {
    wx.showToast({
      title,
      icon,
      duration
    });
  },

  // 显示模态对话框
  showModal(options) {
    return new Promise((resolve) => {
      wx.showModal({
        title: options.title || '提示',
        content: options.content || '',
        showCancel: options.showCancel !== false,
        cancelText: options.cancelText || '取消',
        confirmText: options.confirmText || '确定',
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
      
      // 添加token到请求头
      if (this.globalData.token) {
        header.Authorization = `Bearer ${this.globalData.token}`;
      }
      
      // 添加默认请求头
      header['Content-Type'] = header['Content-Type'] || 'application/json';
      
      wx.request({
        url: url.startsWith('http') ? url : `${this.globalData.baseUrl}${url}`,
        method,
        data,
        header,
        success: (res) => {
          if (res.statusCode === 200) {
            if (res.data.code === 200) {
              resolve(res.data);
            } else if (res.data.code === 401) {
              // token过期，清除用户信息并跳转到登录页
              this.clearUserInfo();
              wx.reLaunch({
                url: '/pages/login/login'
              });
              reject(new Error(res.data.message));
            } else {
              reject(new Error(res.data.message));
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}`));
          }
        },
        fail: (error) => {
          reject(error);
        }
      });
    });
  },

  // 页面跳转
  navigateTo(url, params = {}) {
    const query = Object.keys(params)
      .map(key => `${key}=${encodeURIComponent(params[key])}`)
      .join('&');
    
    const fullUrl = query ? `${url}?${query}` : url;
    
    wx.navigateTo({
      url: fullUrl,
      fail: (error) => {
        console.error('页面跳转失败:', error);
        this.showToast('页面跳转失败');
      }
    });
  },

  // 重定向页面
  redirectTo(url, params = {}) {
    const query = Object.keys(params)
      .map(key => `${key}=${encodeURIComponent(params[key])}`)
      .join('&');
    
    const fullUrl = query ? `${url}?${query}` : url;
    
    wx.redirectTo({
      url: fullUrl,
      fail: (error) => {
        console.error('页面重定向失败:', error);
        this.showToast('页面重定向失败');
      }
    });
  },

  // 重启小程序
  reLaunch(url, params = {}) {
    const query = Object.keys(params)
      .map(key => `${key}=${encodeURIComponent(params[key])}`)
      .join('&');
    
    const fullUrl = query ? `${url}?${query}` : url;
    
    wx.reLaunch({
      url: fullUrl,
      fail: (error) => {
        console.error('重启小程序失败:', error);
        this.showToast('重启小程序失败');
      }
    });
  },

  // 返回上一页
  navigateBack(delta = 1) {
    wx.navigateBack({
      delta,
      fail: (error) => {
        console.error('返回上一页失败:', error);
        this.showToast('返回上一页失败');
      }
    });
  },

  // 设置导航栏标题
  setNavigationBarTitle(title) {
    wx.setNavigationBarTitle({
      title,
      fail: (error) => {
        console.error('设置导航栏标题失败:', error);
      }
    });
  },

  // 设置导航栏颜色
  setNavigationBarColor(options) {
    wx.setNavigationBarColor({
      frontColor: options.frontColor || '#000000',
      backgroundColor: options.backgroundColor || '#ffffff',
      fail: (error) => {
        console.error('设置导航栏颜色失败:', error);
      }
    });
  },

  // 获取用户授权设置
  getSetting() {
    return new Promise((resolve, reject) => {
      wx.getSetting({
        success: resolve,
        fail: reject
      });
    });
  },

  // 获取用户信息
  getUserProfile() {
    return new Promise((resolve, reject) => {
      wx.getUserProfile({
        desc: '用于完善用户资料',
        success: resolve,
        fail: reject
      });
    });
  },

  // 检查用户是否已授权
  checkAuthScope(scope) {
    return new Promise((resolve, reject) => {
      wx.getSetting({
        success: (res) => {
          resolve(res.authSetting[scope] || false);
        },
        fail: reject
      });
    });
  },

  // 打开授权设置页面
  openSetting() {
    return new Promise((resolve, reject) => {
      wx.openSetting({
        success: resolve,
        fail: reject
      });
    });
  }
});