{
  "targets": [
    {
      "target_name": "escpos_driver",
      "sources": [
        "escpos_driver.cpp"
      ],
      "cflags!": [ "-fno-exceptions" ],
      "cflags_cc!": [ "-fno-exceptions" ],
      "defines": [ "NAPI_VERSION=8" ]
    }
  ]
}
