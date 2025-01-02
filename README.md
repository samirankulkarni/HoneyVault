# HoneyVault
This repository I've tried to create POC of honeyvault.
It is basically a password manager.
It is uses honeywords.
run the cloud server
run the genai server
run your tests from on_prem_server/tests.js

How it works ->
1) tingoDB database is used
2) a logical entity is called vault. to access anything in a vault we need a password called masterpassword og that vault.
3) that master password could be thought as encryption key for entire vault. (just a thoight cause we dont actually encrypt vault with it).
4) once you have vaultname and master password of that vault you could store {key:value} based anything you want to protect.
5) For each entry {key:value} you would need a secret.
6) when creating each entry key and secret are stored as plaintext on on prem server while value is stored encrypted way.
7) that encryption key is sent to cloud server and also key and secret name.
