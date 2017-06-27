<?php

use Silex\Application;
use Silex\Provider\AssetServiceProvider;
use Silex\Provider\TwigServiceProvider;
use Silex\Provider\ServiceControllerServiceProvider;
use Silex\Provider\HttpFragmentServiceProvider;


$app = new Application();
$app->register(new ServiceControllerServiceProvider());

$app->register(new AssetServiceProvider());
$app->register(new HttpFragmentServiceProvider());
$app->register(new TwigServiceProvider());
$app['twig'] = $app->extend('twig', function ($twig, $app) {
    return $twig;
});


##### bd
$app->register(new Silex\Provider\DoctrineServiceProvider(), array(
    'dbs.options' => array (
        'mysql_read' => array(
            'driver'    => 'pdo_mysql',
            'host'      => '127.0.0.1',
            'dbname'    => 'fornecedores',
            'user'      => 'root',
            'password'  => '123456789',
            'charset'   => 'utf8mb4',
        ),
    ),
));

return $app;
