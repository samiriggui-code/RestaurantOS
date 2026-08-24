import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/api/menu', () => {
    return HttpResponse.json([
      {
        id: 'item-1',
        name: 'Espresso',
        nameAr: 'إسبريسو',
        description: 'Rich coffee shot',
        descriptionAr: 'قهوة غنية',
        price: 12.0,
        category: 'Coffee',
        image: null,
        available: true,
      },
      {
        id: 'item-2',
        name: 'Cappuccino',
        nameAr: 'كابتشينو',
        description: 'Espresso with steamed milk foam',
        descriptionAr: 'إسبريسو مع حليب رغوي',
        price: 16.0,
        category: 'Coffee',
        image: null,
        available: true,
      },
      {
        id: 'item-3',
        name: 'Croissant',
        nameAr: 'كرواسون',
        description: 'Buttery flaky pastry',
        descriptionAr: 'معجنات بالزبدة',
        price: 15.0,
        category: 'Pastry',
        image: null,
        available: true,
      },
    ]);
  }),

  http.get('/api/menu/categories', () => {
    return HttpResponse.json([
      {
        id: 'cat-1',
        name: 'Coffee',
        nameAr: 'قهوة',
        sortOrder: 0,
        isActive: true,
        items: [
          {
            id: 'item-1',
            categoryId: 'cat-1',
            name: 'Espresso',
            nameAr: 'إسبريسو',
            description: '',
            descriptionAr: '',
            price: 12,
            discountPrice: null,
            image: null,
            isAvailable: true,
            isActive: true,
            prepTime: 3,
            sortOrder: 0,
            modifiers: [],
          },
          {
            id: 'item-2',
            categoryId: 'cat-1',
            name: 'Cappuccino',
            nameAr: 'كابتشينو',
            description: '',
            descriptionAr: '',
            price: 16,
            discountPrice: null,
            image: null,
            isAvailable: true,
            isActive: true,
            prepTime: 5,
            sortOrder: 1,
            modifiers: [],
          },
        ],
      },
      {
        id: 'cat-2',
        name: 'Pastry',
        nameAr: 'معجنات',
        sortOrder: 1,
        isActive: true,
        items: [
          {
            id: 'item-3',
            categoryId: 'cat-2',
            name: 'Croissant',
            nameAr: 'كرواسون',
            description: '',
            descriptionAr: '',
            price: 15,
            discountPrice: null,
            image: null,
            isAvailable: true,
            isActive: true,
            prepTime: 0,
            sortOrder: 0,
            modifiers: [],
          },
        ],
      },
    ]);
  }),

  http.post('/api/menu/categories', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      id: 'cat-new',
      ...(body as Record<string, unknown>),
      items: [],
      isActive: true,
    });
  }),

  http.put('/api/menu/categories/:id', async ({ params, request }) => {
    const body = await request.json();
    return HttpResponse.json({
      id: params.id,
      ...(body as Record<string, unknown>),
      items: [],
      isActive: true,
    });
  }),

  http.delete('/api/menu/categories/:id', () => {
    return HttpResponse.json({ success: true });
  }),

  http.post('/api/menu/items', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      id: 'item-new',
      ...(body as Record<string, unknown>),
      isAvailable: true,
      isActive: true,
      modifiers: [],
    });
  }),

  http.put('/api/menu/items/:id', async ({ params, request }) => {
    const body = await request.json();
    return HttpResponse.json({
      id: params.id,
      ...(body as Record<string, unknown>),
      isAvailable: true,
      isActive: true,
    });
  }),

  http.delete('/api/menu/items/:id', () => {
    return HttpResponse.json({ success: true });
  }),

  http.patch('/api/menu/items/:id/toggle', ({ params }) => {
    return HttpResponse.json({ id: params.id, isAvailable: false });
  }),

  http.post('/api/menu/items/:id/image', () => {
    return HttpResponse.json({ image: '/uploads/test-image.jpg' });
  }),

  http.get('/api/orders', ({ request }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    if (status && (status.includes('PENDING') || status.includes('CONFIRMED'))) {
      return HttpResponse.json([
        {
          id: 'order-1',
          orderNumber: 1001,
          businessId: 'biz-1',
          tableId: 'table-1',
          status: 'PENDING',
          type: 'DINE_IN',
          paymentStatus: 'UNPAID',
          subtotal: 24,
          tax: 3.6,
          serviceCharge: 2.4,
          discount: 0,
          total: 30,
          isOnlineOrder: false,
          notes: '',
          table: { id: 'table-1', number: '5', capacity: 4, status: 'OCCUPIED' },
          customerName: 'Ahmed',
          items: [
            {
              id: 'order-item-1',
              orderId: 'order-1',
              menuItemId: 'item-1',
              menuItem: {
                id: 'item-1',
                name: 'Espresso',
                nameAr: 'إسبريسو',
                price: 12,
                categoryId: 'cat-1',
                isAvailable: true,
                isActive: true,
                prepTime: 3,
                sortOrder: 0,
                modifiers: [],
                description: '',
                descriptionAr: '',
              },
              quantity: 2,
              price: 12,
              status: 'PENDING',
              sortOrder: 0,
              notes: '',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'order-2',
          orderNumber: 1002,
          businessId: 'biz-1',
          tableId: 'table-2',
          status: 'PREPARING',
          type: 'DINE_IN',
          paymentStatus: 'UNPAID',
          subtotal: 16,
          tax: 2.4,
          serviceCharge: 1.6,
          discount: 0,
          total: 20,
          isOnlineOrder: false,
          notes: 'بدون سكر',
          table: { id: 'table-2', number: '3', capacity: 2, status: 'OCCUPIED' },
          items: [
            {
              id: 'order-item-2',
              orderId: 'order-2',
              menuItemId: 'item-2',
              menuItem: {
                id: 'item-2',
                name: 'Cappuccino',
                nameAr: 'كابتشينو',
                price: 16,
                categoryId: 'cat-1',
                isAvailable: true,
                isActive: true,
                prepTime: 5,
                sortOrder: 1,
                modifiers: [],
                description: '',
                descriptionAr: '',
              },
              quantity: 1,
              price: 16,
              status: 'PREPARING',
              sortOrder: 0,
              notes: '',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]);
    }
    return HttpResponse.json({
      data: [
        {
          id: 'order-1',
          orderNumber: 1001,
          status: 'pending',
          total: 24.0,
          items: [{ name: 'Espresso', quantity: 2 }],
          createdAt: new Date().toISOString(),
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
    });
  }),

  http.post('/api/orders', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      id: 'order-new',
      orderNumber: 1003,
      ...body,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    });
  }),

  http.patch('/api/orders/:id/status', async ({ params, request }) => {
    const { status } = (await request.json()) as { status: string };
    return HttpResponse.json({
      id: params.id,
      status,
      updatedAt: new Date().toISOString(),
    });
  }),

  http.post('/api/orders/:orderId/items', async ({ params, request }) => {
    const body = (await request.json()) as {
      items: Array<Record<string, unknown> & { menuItemId?: string }>;
    };
    return HttpResponse.json({
      id: params.orderId,
      orderNumber: 1001,
      items: body.items.map((item, i: number) => ({
        id: `new-item-${i}`,
        orderId: params.orderId,
        ...item,
        status: 'PENDING',
        menuItem: { id: item.menuItemId, name: 'Espresso', nameAr: 'إسبريسو', price: 12 },
      })),
    });
  }),

  http.patch('/api/orders/:orderId/items/:itemId/status', async ({ params, request }) => {
    const { status } = (await request.json()) as { status: string };
    return HttpResponse.json({
      orderId: params.orderId,
      itemId: params.itemId,
      status,
    });
  }),

  http.post('/api/auth/login', async ({ request }) => {
    const body = (await request.json()) as { email?: string; password?: string; pin?: string };

    if (body.pin === '1234') {
      return HttpResponse.json({
        accessToken: 'mock-pin-token',
        user: { id: 'user-2', email: 'waiter@cafe.com', name: 'Waiter', role: 'waiter' },
        business: {
          id: 'biz-1',
          name: 'Test Cafe',
          taxRate: 15,
          serviceChargeRate: 10,
          currency: 'DZD',
        },
      });
    }

    if (!body.email || !body.password) {
      return HttpResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (body.email === 'admin@cafe.com' && body.password === 'admin123') {
      return HttpResponse.json({
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        user: {
          id: 'user-1',
          email: 'admin@cafe.com',
          name: 'Admin User',
          role: 'admin',
        },
        business: {
          id: 'biz-1',
          name: 'Test Cafe',
          nameAr: 'مقهى تجريبي',
          taxRate: 15,
          serviceChargeRate: 10,
          currency: 'DZD',
          wifiDuration: 60,
          wifiVoucherEnabled: false,
          autoPrintOrders: false,
          kitchenDisplayEnabled: true,
        },
      });
    }

    return HttpResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }),

  http.post('/api/auth/logout', () => {
    return HttpResponse.json({ success: true });
  }),

  http.get('/api/auth/me', () => {
    return HttpResponse.json({
      id: 'user-1',
      email: 'admin@cafe.com',
      name: 'Admin User',
      role: 'admin',
    });
  }),

  http.get('/api/settings/public', () => {
    return HttpResponse.json({
      id: 'biz-1',
      name: 'Test Cafe',
      nameAr: 'مقهى تجريبي',
    });
  }),

  http.get('/api/settings/public/:businessId', ({ params }) => {
    return HttpResponse.json({
      id: params.businessId,
      name: 'Test Cafe',
      nameAr: 'مقهى تجريبي',
    });
  }),
];
