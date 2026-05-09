import { type Locator } from '@playwright/test';
import { BasePage } from '../common/BasePage';

// ── Types ─────────────────────────────────────────────────────────────────────

export type OrderStatus =
  | 'pending'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

/** Estados finales — una vez alcanzados, el status no puede cambiarse */
export const FINAL_ORDER_STATUSES: OrderStatus[] = ['delivered', 'cancelled'];

export interface OrderInfo {
  orderNumber: string;
  status: string;
  totalAmount: string;
}

// ── OrdersPage ────────────────────────────────────────────────────────────────

/**
 * Page Object para el tab Orders de /market.
 *
 * Responsabilidades:
 *  - Navegar al tab de Orders
 *  - Leer el listado de órdenes
 *  - Expandir/colapsar el detalle de una orden
 *  - Cambiar el status de una orden (con confirmación modal para estados finales)
 *  - Eliminar una orden (con confirmación modal)
 */
export class OrdersPage extends BasePage {
  // ── Tab ───────────────────────────────────────────────────────────────────

  get ordersTabBtn(): Locator {
    return this.page.locator('.tab').filter({ hasText: 'Orders' });
  }

  get ordersTabContent(): Locator {
    return this.page.locator('#orders-tab');
  }

  // ── Contenido dinámico de orders ──────────────────────────────────────────

  get ordersLoading(): Locator {
    return this.page.locator('#ordersLoading');
  }

  get ordersContent(): Locator {
    return this.page.locator('#ordersContent');
  }

  /** Estado vacío — visible cuando no hay órdenes */
  get emptyState(): Locator {
    return this.page.locator('#ordersContent .empty-state');
  }

  /** Todas las cards de órdenes */
  get orderCards(): Locator {
    return this.page.locator('#ordersContent .order-card');
  }

  get refreshBtn(): Locator {
    return this.page.locator('#orders-tab button', { hasText: '🔄 Refresh' });
  }

  // ── Modal de confirmación de borrado ──────────────────────────────────────

  get deleteOrderModal(): Locator {
    return this.page.locator('#deleteOrderModal');
  }

  get confirmDeleteBtn(): Locator {
    return this.page.locator('#deleteOrderModal button.btn-danger');
  }

  get cancelDeleteBtn(): Locator {
    return this.page.locator('#deleteOrderModal button.btn-secondary');
  }

  // ── Modal de confirmación de estado final ──────────────────────────────────

  get statusChangeModal(): Locator {
    return this.page.locator('#statusChangeModal');
  }

  get statusChangeToText(): Locator {
    return this.page.locator('#statusChangeTo');
  }

  get confirmStatusBtn(): Locator {
    return this.page.locator('#statusChangeModal button.btn-danger', { hasText: 'Confirm' });
  }

  get cancelStatusBtn(): Locator {
    return this.page.locator('#statusChangeModal button.btn-secondary');
  }

  // ── Navegación al tab ─────────────────────────────────────────────────────

  async goToOrdersTab(): Promise<void> {
    await this.ordersTabBtn.click();
    await this.ordersTabContent.waitFor({ state: 'visible' });
    await this.waitForOrdersToLoad();
  }

  // ── Waits ─────────────────────────────────────────────────────────────────

  async waitForOrdersToLoad(): Promise<void> {
    await this.ordersLoading.waitFor({ state: 'hidden' });
  }

  // ── Helper: order card por número de pedido ───────────────────────────────

  /**
   * Retorna el locator de la .order-card que contiene el número de pedido.
   * El order number está en el elemento .order-id dentro del .order-header.
   */
  getOrderCardByNumber(orderNumber: string): Locator {
    return this.page.locator('#ordersContent .order-card').filter({
      has: this.page.locator('.order-id', { hasText: orderNumber }),
    });
  }

  // ── Lecturas de estado ────────────────────────────────────────────────────

  async isOrdersEmpty(): Promise<boolean> {
    return this.emptyState.isVisible();
  }

  async getOrderCount(): Promise<number> {
    return this.orderCards.count();
  }

  /**
   * Lee la información básica (visible en el header de la card, sin expandir).
   */
  async getOrderInfo(orderNumber: string): Promise<OrderInfo> {
    const card = this.getOrderCardByNumber(orderNumber);
    const status = (await card.locator('.order-status').textContent()) ?? '';
    const totalAmount = (await card.locator('.order-header strong').textContent()) ?? '';
    return {
      orderNumber,
      status: status.trim(),
      totalAmount: totalAmount.trim(),
    };
  }

  /**
   * Lee la información de la primera orden del listado.
   * Útil para verificar la orden recién creada.
   */
  async getFirstOrderInfo(): Promise<OrderInfo> {
    const card = this.orderCards.first();
    const orderNumber = (await card.locator('.order-id').textContent()) ?? '';
    const status = (await card.locator('.order-status').textContent()) ?? '';
    const totalAmount = (await card.locator('.order-header strong').textContent()) ?? '';
    return {
      orderNumber: orderNumber.trim(),
      status: status.trim(),
      totalAmount: totalAmount.trim(),
    };
  }

  // ── Expandir / colapsar ────────────────────────────────────────────────────

  /**
   * Abre el detalle de una orden (click en el header).
   * Los controles de status y el botón Delete sólo son accesibles tras expandir.
   */
  async expandOrder(orderNumber: string): Promise<void> {
    const card = this.getOrderCardByNumber(orderNumber);
    const details = card.locator('.order-details');
    const isHidden = await details.evaluate((el) => el.style.display === 'none');
    if (isHidden) {
      await card.locator('.order-header').click();
      await details.waitFor({ state: 'visible' });
    }
  }

  async collapseOrder(orderNumber: string): Promise<void> {
    const card = this.getOrderCardByNumber(orderNumber);
    const details = card.locator('.order-details');
    const isVisible = await details.isVisible();
    if (isVisible) {
      await card.locator('.order-header').click();
      await details.waitFor({ state: 'hidden' });
    }
  }

  // ── Cambio de status ───────────────────────────────────────────────────────

  /**
   * Cambia el status de una orden.
   *
   * - Para estados intermedios (pending → processing → shipped) el cambio
   *   es directo sin modal de confirmación.
   * - Para estados finales (delivered / cancelled) aparece un modal de
   *   confirmación que este método acepta automáticamente.
   *
   * @param orderNumber - Número visible de la orden, ej: "ORD-0001"
   * @param newStatus   - Status destino
   */
  async changeOrderStatus(orderNumber: string, newStatus: OrderStatus): Promise<void> {
    const card = this.getOrderCardByNumber(orderNumber);

    // El select sólo es visible dentro del detalle expandido
    await this.expandOrder(orderNumber);
    await card.locator('select').selectOption(newStatus);

    // Para estados finales, el app lanza el modal de confirmación
    if (FINAL_ORDER_STATUSES.includes(newStatus)) {
      await this.waitForVisible(this.statusChangeModal);
      await this.confirmStatusBtn.click();
      await this.waitForHidden(this.statusChangeModal);
    }

    await this.waitForOrdersToLoad();
  }

  /**
   * Cancela el cambio de status cuando aparece el modal de confirmación
   * (útil para tests negativos: verificar que el status no cambia).
   */
  async cancelStatusChange(orderNumber: string, newStatus: OrderStatus): Promise<void> {
    const card = this.getOrderCardByNumber(orderNumber);
    await this.expandOrder(orderNumber);
    await card.locator('select').selectOption(newStatus);

    if (FINAL_ORDER_STATUSES.includes(newStatus)) {
      await this.waitForVisible(this.statusChangeModal);
      await this.cancelStatusBtn.click();
      await this.waitForHidden(this.statusChangeModal);
    }
  }

  // ── Borrado de orden ───────────────────────────────────────────────────────

  /**
   * Elimina una orden.
   * Expande la card, hace click en "Delete Order" y confirma el modal.
   */
  async deleteOrder(orderNumber: string): Promise<void> {
    const card = this.getOrderCardByNumber(orderNumber);
    await this.expandOrder(orderNumber);
    await card.locator('button.btn-danger', { hasText: 'Delete Order' }).click();
    await this.waitForVisible(this.deleteOrderModal);
    await this.confirmDeleteBtn.click();
    await this.waitForHidden(this.deleteOrderModal);
    await this.waitForOrdersToLoad();
  }

  /** Cancela la confirmación de borrado */
  async cancelDeleteOrder(orderNumber: string): Promise<void> {
    const card = this.getOrderCardByNumber(orderNumber);
    await this.expandOrder(orderNumber);
    await card.locator('button.btn-danger', { hasText: 'Delete Order' }).click();
    await this.waitForVisible(this.deleteOrderModal);
    await this.cancelDeleteBtn.click();
    await this.waitForHidden(this.deleteOrderModal);
  }

  // ── Items de una orden ─────────────────────────────────────────────────────

  /**
   * Lee los items de una orden expandida.
   * Retorna array con { name, amount } de cada línea.
   */
  async getOrderItems(orderNumber: string): Promise<{ name: string; amount: string }[]> {
    await this.expandOrder(orderNumber);
    const card = this.getOrderCardByNumber(orderNumber);
    const rows = card.locator('.order-item');
    const count = await rows.count();

    const items: { name: string; amount: string }[] = [];
    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      const cells = row.locator('span');
      const name = (await cells.first().textContent()) ?? '';
      const amount = (await cells.last().textContent()) ?? '';
      items.push({ name: name.trim(), amount: amount.trim() });
    }

    return items;
  }
}
