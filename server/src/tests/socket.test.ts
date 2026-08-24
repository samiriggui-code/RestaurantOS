import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { Server as SocketIOServer } from 'socket.io';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { setupSocketHandlers } from '../sockets';

type MockIo = {
  use: jest.Mock;
  on: jest.Mock;
  to: jest.Mock;
};

type MockSocket = {
  id: string;
  handshake: { auth: Record<string, unknown>; query: Record<string, unknown> };
  on: jest.Mock;
  join: jest.Mock;
  emit: jest.Mock;
  to: jest.Mock;
  userId: string | undefined;
  businessId: string | undefined;
  role: string | undefined;
};

type SocketMiddleware = (socket: MockSocket, next: (err?: Error) => void) => void;
type ConnectionHandler = (socket: MockSocket) => void;

describe('Socket Handlers', () => {
  let io: MockIo;
  let socket: MockSocket;
  let prisma: DeepMockProxy<PrismaClient>;
  let useMiddleware: SocketMiddleware;
  let connectionHandler: ConnectionHandler;
  let mockEmit: jest.Mock;
  let mockToEmit: jest.Mock;

  beforeEach(() => {
    mockEmit = jest.fn();
    mockToEmit = jest.fn();
    io = {
      use: jest.fn(),
      on: jest.fn(),
      to: jest.fn().mockReturnValue({ emit: mockEmit }),
    };

    socket = {
      id: 'socket-1',
      handshake: { auth: {}, query: {} },
      on: jest.fn(),
      join: jest.fn(),
      emit: jest.fn(),
      to: jest.fn().mockReturnValue({ emit: mockToEmit }),
      userId: undefined,
      businessId: undefined,
      role: undefined,
    };

    prisma = mockDeep<PrismaClient>();

    setupSocketHandlers(io as unknown as SocketIOServer, prisma);

    useMiddleware = io.use.mock.calls[0][0];
    connectionHandler = io.on.mock.calls.find(
      (c: [string, (...args: unknown[]) => unknown]) => c[0] === 'connection'
    )[1];
  });

  describe('Authentication middleware', () => {
    it('should authenticate socket with valid token', () => {
      const next = jest.fn();
      const token = jwt.sign(
        { userId: 'user-1', businessId: 'biz-1', role: 'ADMIN' },
        process.env.JWT_SECRET!
      );
      socket.handshake.auth = { token };

      useMiddleware(socket, next);

      expect(socket.userId).toBe('user-1');
      expect(socket.businessId).toBe('biz-1');
      expect(socket.role).toBe('ADMIN');
      expect(next).toHaveBeenCalledWith();
    });

    it('should allow unauthenticated connections (no token)', () => {
      const next = jest.fn();

      useMiddleware(socket, next);

      expect(socket.userId).toBeUndefined();
      expect(next).toHaveBeenCalledWith();
    });

    it('should reject invalid token', () => {
      const next = jest.fn();
      socket.handshake.auth = { token: 'invalid-jwt-token' };

      useMiddleware(socket, next);

      expect(next).toHaveBeenCalledWith(new Error('Authentication failed'));
    });

    it('should read token from query string if not in auth', () => {
      const next = jest.fn();
      const token = jwt.sign(
        { userId: 'user-2', businessId: 'biz-2', role: 'CHEF' },
        process.env.JWT_SECRET!
      );
      socket.handshake.query = { token };

      useMiddleware(socket, next);

      expect(socket.userId).toBe('user-2');
      expect(socket.businessId).toBe('biz-2');
      expect(socket.role).toBe('CHEF');
      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('Connection handler', () => {
    beforeEach(() => {
      socket.businessId = 'biz-1';
      socket.role = 'ADMIN';
      connectionHandler(socket);
    });

    it('should join business room when authenticated', () => {
      expect(socket.join).toHaveBeenCalledWith('business:biz-1');
    });

    it('should not join business room when not authenticated', () => {
      socket.businessId = undefined;
      socket.join.mockClear();
      connectionHandler(socket);
      expect(socket.join).not.toHaveBeenCalled();
    });

    describe('join:business event', () => {
      it('should join the specified business room', () => {
        const handler = socket.on.mock.calls.find(
          (c: [string, (...args: unknown[]) => unknown]) => c[0] === 'join:business'
        )[1];
        handler('biz-2');
        expect(socket.join).toHaveBeenCalledWith('business:biz-2');
      });
    });

    describe('join:table event', () => {
      it('should join the specified table room', () => {
        const handler = socket.on.mock.calls.find(
          (c: [string, (...args: unknown[]) => unknown]) => c[0] === 'join:table'
        )[1];
        handler('table-5');
        expect(socket.join).toHaveBeenCalledWith('table:table-5');
      });
    });

    describe('kitchen:itemDone event', () => {
      it('should update item status to READY and emit to business room', async () => {
        (prisma.orderItem.update as jest.Mock).mockResolvedValue({
          id: 'oi-1',
          status: 'READY',
        });

        const handler = socket.on.mock.calls.find(
          (c: [string, (...args: unknown[]) => unknown]) => c[0] === 'kitchen:itemDone'
        )[1];
        await handler({ orderId: 'order-1', itemId: 'oi-1' });

        expect(prisma.orderItem.update).toHaveBeenCalledWith({
          where: { id: 'oi-1' },
          data: { status: 'READY' },
        });
        expect(io.to).toHaveBeenCalledWith('business:biz-1');
        expect(mockEmit).toHaveBeenCalledWith('kitchen:itemUpdated', {
          orderId: 'order-1',
          itemId: 'oi-1',
          status: 'READY',
        });
      });

      it('should emit error when update fails', async () => {
        (prisma.orderItem.update as jest.Mock).mockRejectedValue(new Error('DB error'));

        const handler = socket.on.mock.calls.find(
          (c: [string, (...args: unknown[]) => unknown]) => c[0] === 'kitchen:itemDone'
        )[1];
        await handler({ orderId: 'order-1', itemId: 'oi-1' });

        expect(socket.emit).toHaveBeenCalledWith('error', { message: 'Failed to update item' });
      });
    });

    describe('kitchen:startPrep event', () => {
      it('should update item status to PREPARING and emit to business room', async () => {
        (prisma.orderItem.update as jest.Mock).mockResolvedValue({
          id: 'oi-1',
          status: 'PREPARING',
        });

        const handler = socket.on.mock.calls.find(
          (c: [string, (...args: unknown[]) => unknown]) => c[0] === 'kitchen:startPrep'
        )[1];
        await handler({ orderId: 'order-1', itemId: 'oi-1' });

        expect(prisma.orderItem.update).toHaveBeenCalledWith({
          where: { id: 'oi-1' },
          data: { status: 'PREPARING' },
        });
        expect(io.to).toHaveBeenCalledWith('business:biz-1');
        expect(mockEmit).toHaveBeenCalledWith('kitchen:itemUpdated', {
          orderId: 'order-1',
          itemId: 'oi-1',
          status: 'PREPARING',
        });
      });

      it('should emit error when update fails', async () => {
        (prisma.orderItem.update as jest.Mock).mockRejectedValue(new Error('DB error'));

        const handler = socket.on.mock.calls.find(
          (c: [string, (...args: unknown[]) => unknown]) => c[0] === 'kitchen:startPrep'
        )[1];
        await handler({ orderId: 'order-1', itemId: 'oi-1' });

        expect(socket.emit).toHaveBeenCalledWith('error', { message: 'Failed to update item' });
      });
    });

    describe('table:callService event', () => {
      it('should emit service called event to the business room', () => {
        (prisma as unknown as Record<string, unknown>).table = undefined;

        const handler = socket.on.mock.calls.find(
          (c: [string, (...args: unknown[]) => unknown]) => c[0] === 'table:callService'
        )[1];
        handler({ tableId: 'table-1', message: 'Water please' });

        expect(io.to).toHaveBeenCalledWith('business:biz-1');
        expect(mockEmit).toHaveBeenCalledWith(
          'table:serviceCalled',
          expect.objectContaining({
            tableId: 'table-1',
            message: 'Water please',
          })
        );
      });
    });

    describe('order:typing event', () => {
      it('should emit typing indicator to business room excluding sender', () => {
        const handler = socket.on.mock.calls.find(
          (c: [string, (...args: unknown[]) => unknown]) => c[0] === 'order:typing'
        )[1];
        handler({ tableId: 'table-1', isTyping: true });

        expect(socket.to).toHaveBeenCalledWith('business:biz-1');
        expect(mockToEmit).toHaveBeenCalledWith('order:customerTyping', {
          tableId: 'table-1',
          isTyping: true,
        });
      });
    });

    describe('disconnect event', () => {
      it('should log disconnect and allow cleanup', () => {
        const handler = socket.on.mock.calls.find(
          (c: [string, (...args: unknown[]) => unknown]) => c[0] === 'disconnect'
        )[1];
        expect(() => handler()).not.toThrow();
      });
    });
  });
});
