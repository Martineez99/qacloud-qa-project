import { type Locator } from '@playwright/test';
import { BasePage } from '../common/BasePage';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BasketItem {
  name: string;
  quantity: number;
  subtotal: string;
}

export interface OrderSummary {
  orderNumber: string;
  totalAmount: string;
}

// ── BasketPage ────────────────────────────────────────────────────────────────

/**
 * Page Object para el tab Basket de /market.
 *
 * Responsabilidades:
 *  - Navegar al tab de Basket
 *  - Leer y manipular items del basket (cantidad, eliminar)
 *  - Limpiar el basket completo
 *  - Leer el resumen de compra (totales)
 *  - Hacer checkout (Place Order) y capturar el número de pedido
 */
export class BasketPage extends BasePage {
  // ── Tab ───────────────────────────────────────────────────────────────────

  get basketTabBtn(): Locator {
    return this.page.locator('.tab').filter({ hasText: 'Basket' });
  }

  get basketTabContent(): Locator {
    return this.page.locator('#basket-tab');
  }

  // ── Contenido dinámico del basket ─────────────────────────────────────────

  get basketLoading(): Locator {
    return this.page.locator('#basketLoading');
  }

  get basketContent(): Locator {
    return this.page.locator('#basketContent');
  }

  /** Estado vacío — visible cuando no hay items en el basket */
  get emptyState(): Locator {
    return this.page.locator('#basketContent .empty-state');
  }

  /** Todas las filas de items del basket (generadas dinámicamente) */
  get basketItems(): Locator {
    return this.page.locator('#basketContent .basket-item');
  }

  // ── Botones de control del basket ─────────────────────────────────────────

  get refreshBtn(): Locator {
    return this.page.locator('#basket-tab button', { hasText: '🔄 Refresh' });
  }

  /**
   * Botón "Clear All" — dispara window.confirm() nativo.
   * Usar clearBasket() en lugar de hacer click directo.
   */
  get clearAllBtn(): Locator {
    return this.page.locator('#basket-tab button.btn-danger', { hasText: '🗑️ Clear All' });
  }

  // ── Checkout card (aparece sólo cuando hay items) ─────────────────────────

  get checkoutCard(): Locator {
    return this.page.locator('#basketContent .basket-checkout-card');
  }

  get checkoutItemCountRow(): Locator {
    return this.page.locator('#basketContent .basket-checkout-row');
  }

  /** Fila de total — contiene "Total" y el importe final */
  get checkoutTotalRow(): Locator {
    return this.page.locator('#basketContent .basket-checkout-total');
  }

  get placeOrderBtn(): Locator {
    return this.page.locator('#basketContent .basket-checkout-card .btn-primary');
  }

  // ── Modal de éxito al crear order ─────────────────────────────────────────

  get orderSuccessModal(): Locator {
    return this.page.locator('#orderSuccessModal');
  }

  get orderNumberEl(): Locator {
    return this.page.locator('#orderNumber');
  }

  get orderTotalEl(): Locator {
    return this.page.locator('#orderTotal');
  }

  get orderItemsList(): Locator {
    return this.page.locator('#orderItemsList');
  }

  get viewOrdersBtn(): Locator {
    return this.page.locator('#orderSuccessModal button', { hasText: 'View Orders' });
  }

  get continueShoppingBtn(): Locator {
    return this.page.locator('#orderSuccessModal button', { hasText: 'Continue Shopping' });
  }

  // ── Navegación al tab ─────────────────────────────────────────────────────

  async goToBasketTab(): Promise<void> {
    await this.basketTabBtn.click();
    await this.basketTabContent.waitFor({ state: 'visible' });
    await this.waitForBasketToLoad();
  }

  // ── Waits ─────────────────────────────────────────────────────────────────

  async waitForBasketToLoad(): Promise<void> {
    await this.basketLoading.waitFor({ state: 'hidden' });
  }

  // ── Helper: item del basket por nombre ───────────────────────────────────

  /**
   * Retorna el locator del .basket-item que contiene el nombre indicado.
   */
  getBasketItemByName(productName: string): Locator {
    return this.page.locator('#basketContent .basket-item').filter({
      has: this.page.locator('h3', { hasText: productName }),
    });
  }

  // ── Lecturas de estado ────────────────────────────────────────────────────

  async isBasketEmpty(): Promise<boolean> {
    return this.emptyState.isVisible();
  }

  async getBasketItemCount(): Promise<number> {
    return this.basketItems.count();
  }

  async getItemQuantity(productName: string): Promise<number> {
    const item = this.getBasketItemByName(productName);
    const qtyText = await item.locator('.quantity-control span').textContent();
    return parseInt(qtyText ?? '0', 10);
  }

  async getItemSubtotal(productName: string): Promise<string> {
    const item = this.getBasketItemByName(productName);
    // "Subtotal: $XX.XX" — el párrafo de subtotal dentro del basket-item
    return (await item.locator('p[style*="font-weight: bold"]').textContent()) ?? '';
  }

  /**
   * Lee el total del order summary.
   * Ejemplo de retorno: "$12.48"
   */
  async getTotalAmount(): Promise<string> {
    const totalSpan = this.checkoutTotalRow.locator('span').last();
    return (await totalSpan.textContent()) ?? '';
  }

  // ── Manipulación de items ─────────────────────────────────────────────────

  /**
   * Incrementa la cantidad de un item usando el botón + dentro del basket.
   * Si el stock disponible es 0, el botón estará deshabilitado.
   */
  async incrementItem(productName: string): Promise<void> {
    const item = this.getBasketItemByName(productName);
    // El botón + es el segundo (índice 1) del quantity-control
    await item.locator('.quantity-control button').nth(1).click();
    await this.waitForBasketToLoad();
  }

  /**
   * Decrementa la cantidad de un item usando el botón -.
   * Si quantity llega a 0, el item se elimina del basket.
   */
  async decrementItem(productName: string): Promise<void> {
    const item = this.getBasketItemByName(productName);
    // El botón - es el primero (índice 0)
    await item.locator('.quantity-control button').nth(0).click();
    await this.waitForBasketToLoad();
  }

  /** Elimina un item usando el botón "Remove" */
  async removeItem(productName: string): Promise<void> {
    const item = this.getBasketItemByName(productName);
    await item.locator('button.btn-danger', { hasText: 'Remove' }).click();
  }

  /**
   * Limpia todo el basket.
   * Gestiona el window.confirm() nativo registrando el handler ANTES del click.
   */
  async clearBasket(): Promise<void> {
    this.page.once('dialog', (dialog) => void dialog.accept());
    await this.clearAllBtn.click();
    await this.waitForBasketToLoad();
  }

  // ── Checkout ──────────────────────────────────────────────────────────────

  /**
   * Hace click en "Place Order", espera el modal de éxito y retorna el summary.
   * No cierra el modal — el test decide qué hacer a continuación.
   */
  async placeOrder(): Promise<OrderSummary> {
    await this.placeOrderBtn.click();
    await this.waitForVisible(this.orderSuccessModal);

    const orderNumber = (await this.orderNumberEl.textContent()) ?? '';
    const totalAmount = (await this.orderTotalEl.textContent()) ?? '';

    return {
      orderNumber: orderNumber.trim(),
      totalAmount: totalAmount.trim(),
    };
  }

  /**
   * Cierra el modal de éxito y navega al tab de Orders.
   */
  async closeOrderModalAndGoToOrders(): Promise<void> {
    await this.viewOrdersBtn.click();
    await this.waitForHidden(this.orderSuccessModal);
  }

  /**
   * Cierra el modal de éxito y continúa en Products.
   */
  async closeOrderModalAndContinueShopping(): Promise<void> {
    await this.continueShoppingBtn.click();
    await this.waitForHidden(this.orderSuccessModal);
  }

  /** Cierra el modal usando el botón ×  */
  async closeOrderSuccessModal(): Promise<void> {
    await this.orderSuccessModal.locator('button.close-btn').click();
    await this.waitForHidden(this.orderSuccessModal);
  }
}
