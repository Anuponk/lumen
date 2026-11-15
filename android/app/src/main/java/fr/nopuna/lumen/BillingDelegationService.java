package fr.nopuna.lumen;

import com.google.androidbrowserhelper.playbilling.digitalgoods.DigitalGoodsRequestHandler;
import com.google.androidbrowserhelper.trusted.DelegationService;

/**
 * #729: exposes the Digital Goods API to the web app so that purchases inside the
 * Play-distributed TWA use Google Play Billing. Purchases are verified server-side.
 */
public class BillingDelegationService extends DelegationService {
    @Override
    public void onCreate() {
        super.onCreate();
        registerExtraCommandHandler(new DigitalGoodsRequestHandler(getApplicationContext()));
    }
}
