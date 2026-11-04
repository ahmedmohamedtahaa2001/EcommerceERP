'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';

export default function NewOrderPage() {
  const [step, setStep] = useState(1);
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: customersData } = await supabase.from('customers').select('*');
        const { data: productsData } = await supabase.from('products').select('*');
        setCustomers(customersData || []);
        setProducts(productsData || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleSelectCustomer = (customer: any) => {
    setSelectedCustomer(customer);
    setStep(2);
  };

  const handleAddProduct = (product: any, quantity: number) => {
    if (quantity <= 0) return;

    const existingItem = orderItems.find(item => item.productId === product.id);
    if (existingItem) {
      setOrderItems(
        orderItems.map(item =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + quantity, total: (item.quantity + quantity) * item.price }
            : item
        )
      );
    } else {
      setOrderItems([
        ...orderItems,
        {
          productId: product.id,
          productName: product.name,
          productSku: product.sku,
          quantity,
          price: product.price,
          total: quantity * product.price,
        },
      ]);
    }
  };

  const handleRemoveItem = (productId: string) => {
    setOrderItems(orderItems.filter(item => item.productId !== productId));
  };

  const handleCreateOrder = async () => {
    if (!selectedCustomer || orderItems.length === 0) {
      setError('Please select customer and add items');
      return;
    }

    try {
      setLoading(true);
      const total = orderItems.reduce((sum, item) => sum + item.total, 0);
      const orderNumber = `ORD-${Date.now()}`;

      const { data: orderData, error: createError } = await supabase
        .from('orders')
        .insert([
          {
            order_number: orderNumber,
            customer_id: selectedCustomer.id,
            status: 'pending',
            payment_status: 'pending',
            total,
            company_id: '11111111-1111-1111-1111-111111111111',
          },
        ])
        .select();

      if (createError) throw createError;

      if (orderData && orderData[0]) {
        const orderItems_db = orderItems.map(item => ({
          order_id: orderData[0].id,
          product_id: item.productId,
          quantity: item.quantity,
          price: item.price,
          total: item.total,
        }));

        const { error: itemsError } = await supabase.from('order_items').insert(orderItems_db);
        if (itemsError) throw itemsError;

        router.push(`/dashboard/orders/${orderData[0].id}`);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const total = orderItems.reduce((sum, item) => sum + item.total, 0);

  if (loading && step === 1) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Link href="/dashboard/orders" className="text-blue-600 hover:text-blue-700">
          ← Back to Orders
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Create New Order</h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Progress Indicator */}
      <div className="flex gap-4">
        <div className={`flex-1 p-4 rounded-lg text-center font-medium cursor-pointer transition ${
          step === 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
        }`} onClick={() => setStep(1)}>
          Step 1: Select Customer
        </div>
        <div className={`flex-1 p-4 rounded-lg text-center font-medium cursor-pointer transition ${
          step === 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
        }`} onClick={() => selectedCustomer && setStep(2)}>
          Step 2: Add Products
        </div>
        <div className={`flex-1 p-4 rounded-lg text-center font-medium cursor-pointer transition ${
          step === 3 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
        }`} onClick={() => orderItems.length > 0 && setStep(3)}>
          Step 3: Review
        </div>
      </div>

      {/* Step 1: Select Customer */}
      {step === 1 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Select Customer</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {customers.length === 0 ? (
              <p className="text-gray-500">No customers found. Create one first.</p>
            ) : (
              customers.map(customer => (
                <button
                  key={customer.id}
                  onClick={() => handleSelectCustomer(customer)}
                  className="p-4 border-2 border-gray-300 rounded-lg hover:border-blue-600 hover:bg-blue-50 transition text-left"
                >
                  <p className="font-medium text-gray-900">{customer.name}</p>
                  <p className="text-sm text-gray-600">{customer.email}</p>
                  <p className="text-sm text-gray-500">Orders: {customer.total_orders}</p>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Step 2: Add Products */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Add Products</h2>
            <p className="text-gray-600 mb-4">Customer: <strong>{selectedCustomer?.name}</strong></p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {products.map(product => (
                <ProductSelector
                  key={product.id}
                  product={product}
                  onAdd={(qty) => handleAddProduct(product, qty)}
                />
              ))}
            </div>
          </div>

          {/* Selected Items */}
          {orderItems.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Selected Items ({orderItems.length})</h3>
              <div className="space-y-2">
                {orderItems.map(item => (
                  <div key={item.productId} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                    <div>
                      <p className="font-medium text-gray-900">{item.productName}</p>
                      <p className="text-sm text-gray-600">{item.quantity} x {formatCurrency(item.price)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="font-bold text-gray-900">{formatCurrency(item.total)}</p>
                      <button
                        onClick={() => handleRemoveItem(item.productId)}
                        className="text-red-600 hover:text-red-700"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-900 rounded-lg font-medium"
            >
              ← Back
            </button>
            <button
              onClick={() => orderItems.length > 0 && setStep(3)}
              disabled={orderItems.length === 0}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Review */}
      {step === 3 && (
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Order Review</h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">Customer</p>
                <p className="font-medium text-gray-900">{selectedCustomer?.name}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left">Product</th>
                      <th className="px-4 py-2 text-right">Qty</th>
                      <th className="px-4 py-2 text-right">Price</th>
                      <th className="px-4 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {orderItems.map(item => (
                      <tr key={item.productId}>
                        <td className="px-4 py-2">{item.productName}</td>
                        <td className="px-4 py-2 text-right">{item.quantity}</td>
                        <td className="px-4 py-2 text-right">{formatCurrency(item.price)}</td>
                        <td className="px-4 py-2 text-right font-medium">{formatCurrency(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Order Total</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">{formatCurrency(total)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Shipping</span>
                  <span className="font-medium">{formatCurrency(0)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-3">
                  <span>Total</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => setStep(2)}
                className="w-full px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-900 rounded-lg font-medium"
              >
                ← Edit Items
              </button>
              <button
                onClick={handleCreateOrder}
                disabled={loading}
                className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg font-medium"
              >
                {loading ? 'Creating...' : 'Create Order'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProductSelector({ product, onAdd }: { product: any; onAdd: (qty: number) => void }) {
  const [quantity, setQuantity] = useState(1);

  return (
    <div className="p-4 border border-gray-300 rounded-lg">
      <p className="font-medium text-gray-900">{product.name}</p>
      <p className="text-sm text-gray-600 mb-2">{product.sku}</p>
      <p className="text-lg font-bold text-gray-900 mb-3">${product.price.toFixed(2)}</p>
      <div className="flex gap-2">
        <input
          type="number"
          min="1"
          value={quantity}
          onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
          className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
        />
        <button
          onClick={() => onAdd(quantity)}
          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium"
        >
          Add
        </button>
      </div>
    </div>
  );
}
