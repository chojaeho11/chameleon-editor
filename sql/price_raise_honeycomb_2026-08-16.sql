update admin_products set price=130000, price_jp=13000, price_us=130 where code='hb_dw_1';
update admin_products set price=75000,  price_jp=7500,  price_us=75  where code='43535555';
update admin_products set price=55000,  price_jp=5500,  price_us=55  where code='hb_bn_1';
update admin_products set price=55000,  price_jp=5500,  price_us=55  where code='hb_pt_1';
select code, name, price, price_jp, price_us from admin_products where code in ('hb_dw_1','43535555','hb_bn_1','hb_pt_1') order by code;
