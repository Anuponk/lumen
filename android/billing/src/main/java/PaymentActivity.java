// Copyright 2020 Google Inc. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package com.google.androidbrowserhelper.playbilling.provider;

import android.app.Activity;
import android.content.ComponentName;
import android.content.Intent;
import android.os.Bundle;

import androidx.annotation.Nullable;

import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.ProductDetails;

import java.util.Collections;
import java.util.List;

public class PaymentActivity extends Activity implements BillingWrapper.Listener {
    private static final String TAG = "PaymentActivity";

    private static final String METHOD_NAME = "https://play.google.com/billing";

    static final String PROXY_PACKAGE_KEY = "PROXY_PACKAGE";

    private BillingWrapper mWrapper;
    private MethodData mMethodData;

    @Override
    public void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        ComponentName component = getCallingActivity();
        if (component == null) {
            fail("Must be launched with startActivityForResult.");
            return;
        }

        if (!PaymentVerifier.shouldAllowPayments(this, component.getPackageName(), TAG)) {
            fail("Launching app is not verified.");
            return;
        }

        getIntent().putExtra(PROXY_PACKAGE_KEY, component.getPackageName());

        mMethodData = MethodData.fromIntent(getIntent());
        if (mMethodData == null) {
            fail("Could not parse product ID.");
            return;
        }
        // Lumen only sells these non-consumable products. Reject before contacting
        // Play when the verified account binding was omitted by the web client.
        if (!mMethodData.sku.matches("real_adventure_0[2-9]|real_sky_all|real_sky_upgrade_[1-4]|lumen_premium")
                || mMethodData.obfuscatedAccountId == null
                || !mMethodData.obfuscatedAccountId.matches("[0-9a-f]{64}")
                || mMethodData.isPriceChangeConfirmation || mMethodData.oldSku != null
                || mMethodData.purchaseToken != null || mMethodData.replacementMode != null) {
            fail("Unsupported purchase or missing account binding.");
            return;
        }

        mWrapper = BillingWrapperFactory.get(this, this);
        mWrapper.connect(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(BillingResult billingResult) {
                onConnected();
            }

            @Override
            public void onBillingServiceDisconnected() {
                onDisconnected();
            }
        });
    }

    public void onDisconnected() {
        fail("BillingClient disconnected.");
    }

    public void onConnected() {
        List<String> ids = Collections.singletonList(mMethodData.sku);
        mWrapper.queryProductDetails(BillingClient.ProductType.INAPP, ids, this::onProductDetailsQueried);
    }

    private void onProductDetailsQueried(BillingResult result, List<ProductDetails> productDetailsList) {
        if (result.getResponseCode() != BillingClient.BillingResponseCode.OK
                || productDetailsList == null || productDetailsList.size() != 1
                || !mMethodData.sku.equals(productDetailsList.get(0).getProductId())) {
            fail("Play Billing did not find product.");
            return;
        }

        ProductDetails productDetails = productDetailsList.get(0);

        launchPaymentFlow(productDetails);
    }

    private void launchPaymentFlow(ProductDetails productDetails) {
        if (mWrapper.launchPaymentFlow(this, productDetails, mMethodData))
            return;

        fail("Payment attempt failed (have you already bought the item?).");
    }

    @Override
    public void onPurchaseFlowComplete(BillingResult result, String purchaseToken) {
        if (result.getResponseCode() == BillingClient.BillingResponseCode.OK) {
            setResultAndFinish(PaymentResult.paymentSuccess(purchaseToken));
        } else {
            fail("Purchase flow ended with code: " + result.getResponseCode());
        }
    }

    private void fail(String reason) {
        setResultAndFinish(PaymentResult.failure(reason));
    }

    private void setResultAndFinish(PaymentResult result) {
        result.log();

        Intent intent = new Intent();
        intent.putExtra("methodName", METHOD_NAME);
        intent.putExtra("details", result.getDetails());
        setResult(result.getActivityResult(), intent);
        finish();
    }
}
