// index.js
const app = getApp();

Page({
  data: {
    banners: [
      {
        id: 1,
        image: '/images/banner/banner1.jpg',
        title: '新鲜水果',
        link: '/pages/category/category?id=1'
      },
      {
        id: 2,
        image: '/images/banner/banner2.jpg',
        title: '时令蔬菜',
        link: '/pages/category/category?id=2'
      },
      {
        id: 3,
        image: '/images/banner/banner3.jpg',
        title: '优质粮油',
        link: '/pages/category/category?id=3'
      }
    ],
    categories: [],
    hotProducts: [],
    recommendProducts: [],
    hasMore: false,
    showBackToTop: false,
    loading: false
  },

  onLoad() {
    console.log('首页加载');
    this.loadPageData();
  },

  onShow() {
    console.log('首页显示');
    // 更新购物车数量
    this.updateCartCount();
  },

  onPullDownRefresh() {
    console.log('下拉刷新');
    this.loadPageData().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  onReachBottom() {
    console.log('触底加载');
    if (this.data.hasMore && !this.data.loading) {
      this.loadMore();
    }
  },

  onPageScroll(e) {
    // 显示/隐藏回到顶部按钮
    const showBackToTop = e.scrollTop > 300;
    if (this.data.showBackToTop !== showBackToTop) {
      this.setData({
        showBackToTop: showBackToTop
      });
    }
  },

  // 加载页面数据
  async loadPageData() {
    try {
      this.setData({ loading: true });
      
      // 并行加载数据
      const [categories, hotProducts, recommendProducts] = await Promise.all([
        this.loadCategories(),
        this.loadHotProducts(),
        this.loadRecommendProducts()
      ]);

      this.setData({
        categories,
        hotProducts,
        recommendProducts,
        loading: false
      });

    } catch (error) {
      console.error('加载页面数据失败:', error);
      this.setData({ loading: false });
      app.showError('加载数据失败');
    }
  },

  // 加载商品分类
  async loadCategories() {
    try {
      const result = await app.getCategories();
      return result.data || [];
    } catch (error) {
      console.error('加载分类失败:', error);
      return [];
    }
  },

  // 加载热门商品
  async loadHotProducts() {
    try {
      const result = await app.getHotProducts();
      return result.data || [];
    } catch (error) {
      console.error('加载热门商品失败:', error);
      return [];
    }
  },

  // 加载推荐商品
  async loadRecommendProducts() {
    try {
      const result = await app.getRecommendProducts();
      return result.data || [];
    } catch (error) {
      console.error('加载推荐商品失败:', error);
      return [];
    }
  },

  // 加载更多
  async loadMore() {
    if (this.data.loading) return;
    
    try {
      this.setData({ loading: true });
      
      // 这里可以实现分页加载逻辑
      // 暂时只是显示提示
      app.showToast('暂无更多数据');
      
      this.setData({ 
        hasMore: false,
        loading: false 
      });
      
    } catch (error) {
      console.error('加载更多失败:', error);
      this.setData({ loading: false });
      app.showError('加载失败');
    }
  },

  // 更新购物车数量
  async updateCartCount() {
    if (!app.isLoggedIn()) return;
    
    try {
      const result = await app.getCartCount();
      const count = result.data.count || 0;
      
      // 设置tabBar购物车的徽标
      if (count > 0) {
        wx.setTabBarBadge({
          index: 2, // 购物车tab的索引
          text: count.toString()
        });
      } else {
        wx.removeTabBarBadge({
          index: 2
        });
      }
    } catch (error) {
      console.error('更新购物车数量失败:', error);
    }
  },

  // 跳转到搜索页
  goToSearch() {
    wx.navigateTo({
      url: '/pages/search/search'
    });
  },

  // 跳转到分类页
  goToCategory(e) {
    const categoryId = e.currentTarget.dataset.id;
    if (categoryId) {
      wx.switchTab({
        url: '/pages/category/category'
      });
    } else {
      wx.switchTab({
        url: '/pages/category/category'
      });
    }
  },

  // 跳转到商品详情
  goToProduct(e) {
    const productId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/product/detail?id=${productId}`
    });
  },

  // 跳转到更多页面
  goToMore(e) {
    const type = e.currentTarget.dataset.type;
    if (type === 'hot') {
      wx.switchTab({
        url: '/pages/category/category'
      });
    } else if (type === 'recommend') {
      wx.switchTab({
        url: '/pages/category/category'
      });
    }
  },

  // 轮播图点击
  onBannerTap(e) {
    const item = e.currentTarget.dataset.item;
    if (item.link) {
      wx.navigateTo({
        url: item.link
      });
    }
  },

  // 添加到购物车
  async addToCart(e) {
    const productId = e.currentTarget.dataset.id;
    
    if (!app.isLoggedIn()) {
      wx.navigateTo({
        url: '/pages/login/login'
      });
      return;
    }

    try {
      app.showLoading('添加中...');
      
      await app.addToCart(productId, 1);
      
      app.hideLoading();
      app.showSuccess('添加成功');
      
      // 更新购物车数量
      this.updateCartCount();
      
    } catch (error) {
      app.hideLoading();
      app.showError(error.message || '添加失败');
    }
  },

  // 回到顶部
  backToTop() {
    wx.pageScrollTo({
      scrollTop: 0,
      duration: 300
    });
  }
});