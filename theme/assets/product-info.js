if (!customElements.get('product-info')) {
  customElements.define('product-info', class ProductInfo extends HTMLElement {
    constructor() {
      super();
      this.input = this.querySelector('.quantity__input');
      this.currentVariant = this.querySelector('.product-variant-id');
      this.variantSelects = this.querySelector('variant-radios')
      this.submitButton = this.querySelector('[type="submit"]');
    }

    cartUpdateUnsubscriber = undefined;
    variantChangeUnsubscriber = undefined;

    connectedCallback() {
      if (!this.input) return;
      this.quantityForm = this.querySelector('.product-form__quantity');
      if (!this.quantityForm) return;
      this.setQuantityBoundries();  
      if (!this.dataset.originalSection) {
        this.cartUpdateUnsubscriber = subscribe(PUB_SUB_EVENTS.cartUpdate, this.fetchQuantityRules.bind(this));
      }
      this.variantChangeUnsubscriber = subscribe(PUB_SUB_EVENTS.variantChange, (event) => {
        const sectionId = this.dataset.originalSection ? this.dataset.originalSection : this.dataset.section;
        if (event.data.sectionId !== sectionId) return;
        this.updateQuantityRules(event.data.sectionId, event.data.html);
        this.setQuantityBoundries();
      });

      this.refreshProductState();
    }

    disconnectedCallback() {
      if (this.cartUpdateUnsubscriber) {
        this.cartUpdateUnsubscriber();
      }
      if (this.variantChangeUnsubscriber) {
        this.variantChangeUnsubscriber();
      }
    }

    setQuantityBoundries() {
      const data = {
        cartQuantity: this.input.dataset.cartQuantity ? parseInt(this.input.dataset.cartQuantity) : 0,
        min: this.input.dataset.min ? parseInt(this.input.dataset.min) : 1,
        max: this.input.dataset.max ? parseInt(this.input.dataset.max) : null,
        step: this.input.step ? parseInt(this.input.step) : 1
      }

      let min = data.min;
      const max = data.max === null ? data.max : data.max - data.cartQuantity;
      if (max !== null) min = Math.min(min, max);
      if (data.cartQuantity >= data.min) min = Math.min(min, data.step);

      this.input.min = min;
      this.input.max = max;
      this.input.value = min;
      publish(PUB_SUB_EVENTS.quantityUpdate, undefined);  
    }

    fetchSectionHtml() {
      if (!this.currentVariant || !this.currentVariant.value) return Promise.resolve(null);

      const sectionId = this.dataset.originalSection ? this.dataset.originalSection : this.dataset.section;
      return fetch(`${this.dataset.url}?variant=${this.currentVariant.value}&section_id=${sectionId}`)
        .then((response) => response.text())
        .then((responseText) => new DOMParser().parseFromString(responseText, 'text/html'));
    }

    refreshProductState() {
      this.fetchSectionHtml()
        .then((html) => {
          if (!html) return;
          const sectionId = this.dataset.originalSection ? this.dataset.originalSection : this.dataset.section;
          this.syncProductInfo(sectionId, html);
          this.updateQuantityRules(sectionId, html);
          this.setQuantityBoundries();
        })
        .catch((error) => {
          console.error(error);
        });
    }

    fetchQuantityRules() {
      if (!this.currentVariant || !this.currentVariant.value) return;
      this.querySelector('.quantity__rules-cart .loading-overlay').classList.remove('hidden');
      const sectionId = this.dataset.originalSection ? this.dataset.originalSection : this.dataset.section;
      this.fetchSectionHtml()
        .then((html) => {
          if (!html) return;
          this.syncProductInfo(sectionId, html);
          this.updateQuantityRules(sectionId, html);
          this.setQuantityBoundries();
        })
        .catch((error) => {
          console.error(error);
        })
        .finally(() => {
          this.querySelector('.quantity__rules-cart .loading-overlay').classList.add('hidden');
        });
    }

    syncProductInfo(sectionId, html) {
      const priceSource = html.getElementById(`price-${sectionId}`);
      const priceDestination = document.getElementById(`price-${sectionId}`);
      const skuSource = html.getElementById(`Sku-${sectionId}`);
      const skuDestination = document.getElementById(`Sku-${sectionId}`);
      const inventorySource = html.getElementById(`Inventory-${sectionId}`);
      const inventoryDestination = document.getElementById(`Inventory-${sectionId}`);
      const productFormSource = html.getElementById(`product-form-${sectionId}`);
      const productFormDestination = document.getElementById(`product-form-${sectionId}`);
      const installmentSource = html.getElementById(`product-form-installment-${sectionId}`);
      const installmentDestination = document.getElementById(`product-form-installment-${sectionId}`);

      if (priceSource && priceDestination) {
        priceDestination.innerHTML = priceSource.innerHTML;
        priceDestination.classList.remove('visibility-hidden');
      }

      if (inventorySource && inventoryDestination) {
        inventoryDestination.innerHTML = inventorySource.innerHTML;
        inventoryDestination.classList.toggle('visibility-hidden', inventorySource.innerText === '');
      }

      if (skuSource && skuDestination) {
        skuDestination.innerHTML = skuSource.innerHTML;
        skuDestination.classList.toggle('visibility-hidden', skuSource.classList.contains('visibility-hidden'));
      }

      if (productFormSource && productFormDestination) {
        const sourceVariantId = productFormSource.querySelector('input[name="id"]');
        const destinationVariantId = productFormDestination.querySelector('input[name="id"]');
        const sourceButtons = productFormSource.querySelector('.product-form__buttons');
        const destinationButtons = productFormDestination.querySelector('.product-form__buttons');

        if (sourceVariantId && destinationVariantId) {
          destinationVariantId.value = sourceVariantId.value;
          destinationVariantId.toggleAttribute('disabled', sourceVariantId.hasAttribute('disabled'));
        }

        if (sourceButtons && destinationButtons) {
          destinationButtons.innerHTML = sourceButtons.innerHTML;
        }
      }

      if (installmentSource && installmentDestination) {
        installmentDestination.innerHTML = installmentSource.innerHTML;
      }
    }

    updateQuantityRules(sectionId, html) {
      const quantityFormUpdated = html.getElementById(`Quantity-Form-${sectionId}`);
      if (!quantityFormUpdated) return;
      const selectors = ['.quantity__input', '.quantity__rules', '.quantity__label'];
      for (let selector of selectors) { 
        const current = this.quantityForm.querySelector(selector);
        const updated = quantityFormUpdated.querySelector(selector);
        if (!current || !updated) continue;
        if (selector === '.quantity__input') {
          const attributes = ['data-cart-quantity', 'data-min', 'data-max', 'step'];
          for (let attribute of attributes) {
            const valueUpdated = updated.getAttribute(attribute);
            if (valueUpdated !== null) current.setAttribute(attribute, valueUpdated);
          }
        } else {
          current.innerHTML = updated.innerHTML;
        }
      }
    }
  }
)};


