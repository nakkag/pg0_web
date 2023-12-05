<?php
if (isset($_GET["url"]) && $_GET["url"] !== "") {
	$curl = curl_init();
	try {
		curl_setopt($curl, CURLOPT_CUSTOMREQUEST, "GET");
		curl_setopt($curl, CURLOPT_URL, $_GET["url"]);
		curl_setopt($curl, CURLOPT_RETURNTRANSFER, true);
		$buf = curl_exec($curl);
		$httpcode = curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
		$errno = curl_errno($curl);
		curl_close($curl);
		if ($errno !== CURLE_OK) {
			http_response_code(500);
		} else {
			http_response_code($httpcode);
			echo $buf;
		}
	} catch (Exception $e) {
		curl_close($curl);
		error_log($e);
	}
}
?>
