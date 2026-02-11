import unittest
from unittest.mock import Mock, patch

from flask import Flask

from src.routes.hdf5 import hdf5_bp


class _NullCache:
    def get(self, _key):
        return None

    def set(self, _key, _value):
        return None


class Hdf5RoutesTestCase(unittest.TestCase):
    def setUp(self):
        app = Flask(__name__)
        app.register_blueprint(hdf5_bp, url_prefix='/files')
        self.client = app.test_client()

    def test_data_line_allows_large_source_when_downsampled(self):
        reader = Mock()
        reader.get_dataset_info.return_value = {
            'shape': [5_000_000],
            'ndim': 1,
            'dtype': 'float32'
        }
        reader.get_line.return_value = {
            'dtype': 'float32',
            'data': [0.1, 0.2, 0.3],
            'shape': [5000],
            'axis': 'dim',
            'index': None,
            'downsample_info': {'step': 1000}
        }

        with patch('src.routes.hdf5.get_hdf5_reader', return_value=reader):
            response = self.client.get('/files/sample.h5/data?path=/array_1d&mode=line')

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertTrue(payload['success'])
        self.assertEqual(payload['line_limit'], 5_000_000)
        self.assertEqual(payload['quality_requested'], 'auto')
        self.assertEqual(payload['quality_applied'], 'overview')
        self.assertEqual(payload['requested_points'], 5_000_000)
        self.assertEqual(payload['downsample_info']['step'], 1000)
        reader.get_line.assert_called_once()
        args = reader.get_line.call_args[0]
        self.assertEqual(args[7], 5_000_000)  # line_limit
        self.assertEqual(args[8], 1000)  # line_step

    def test_data_line_exact_mode_small_window(self):
        reader = Mock()
        reader.get_dataset_info.return_value = {
            'shape': [10_000],
            'ndim': 1,
            'dtype': 'float32'
        }
        reader.get_line.return_value = {
            'dtype': 'float32',
            'data': [1.0, 2.0, 3.0, 4.0],
            'shape': [4],
            'axis': 'dim',
            'index': None,
            'downsample_info': {'step': 1}
        }

        with patch('src.routes.hdf5.get_hdf5_reader', return_value=reader):
            response = self.client.get(
                '/files/sample.h5/data'
                '?path=/array_1d'
                '&mode=line'
                '&quality=exact'
                '&line_offset=100'
                '&line_limit=4'
            )

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertTrue(payload['success'])
        self.assertEqual(payload['quality_requested'], 'exact')
        self.assertEqual(payload['quality_applied'], 'exact')
        self.assertEqual(payload['line_step'], 1)
        self.assertEqual(payload['requested_points'], 4)
        self.assertEqual(payload['returned_points'], 4)

        reader.get_line.assert_called_once()
        args = reader.get_line.call_args[0]
        self.assertEqual(args[7], 4)  # line_limit
        self.assertEqual(args[8], 1)  # line_step

    def test_data_line_exact_mode_rejects_large_window(self):
        reader = Mock()
        reader.get_dataset_info.return_value = {
            'shape': [2_000_000],
            'ndim': 1,
            'dtype': 'float32'
        }

        with patch('src.routes.hdf5.get_hdf5_reader', return_value=reader):
            response = self.client.get(
                '/files/sample.h5/data'
                '?path=/array_1d'
                '&mode=line'
                '&quality=exact'
                '&line_limit=500000'
            )

        self.assertEqual(response.status_code, 400)
        payload = response.get_json()
        self.assertFalse(payload['success'])
        self.assertIn('Exact line window exceeds', payload['error'])

    def test_data_heatmap_auto_clamps_max_size(self):
        reader = Mock()
        reader.get_dataset_info.return_value = {
            'shape': [5000, 5000],
            'ndim': 2,
            'dtype': 'float32'
        }
        reader.get_heatmap.return_value = {
            'dtype': 'float32',
            'data': [[1.0]],
            'shape': [1, 1],
            'stats': {'min': 1.0, 'max': 1.0},
            'row_offset': 0,
            'col_offset': 0,
            'downsample_info': {'row_step': 8, 'col_step': 8},
            'sampled': True
        }

        with patch('src.routes.hdf5.get_hdf5_reader', return_value=reader):
            response = self.client.get('/files/sample.h5/data?path=/array_2d&mode=heatmap&max_size=1024')

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertTrue(payload['success'])
        self.assertTrue(payload['max_size_clamped'])
        self.assertEqual(payload['requested_max_size'], 1024)
        self.assertEqual(payload['effective_max_size'], 707)
        reader.get_heatmap.assert_called_once()
        args = reader.get_heatmap.call_args[0]
        self.assertEqual(args[4], 707)

    def test_data_normalizes_negative_fixed_indices(self):
        reader = Mock()
        reader.get_dataset_info.return_value = {
            'shape': [10, 20, 30],
            'ndim': 3,
            'dtype': 'float32'
        }
        reader.get_matrix.return_value = {
            'dtype': 'float32',
            'data': [[1.0]],
            'shape': [1, 1],
            'row_offset': 0,
            'col_offset': 0,
            'downsample_info': {'row_step': 1, 'col_step': 1}
        }

        with patch('src.routes.hdf5.get_hdf5_reader', return_value=reader):
            response = self.client.get(
                '/files/sample.h5/data'
                '?path=/array_3d'
                '&mode=matrix'
                '&display_dims=1,2'
                '&fixed_indices=0=-1'
                '&row_limit=1'
                '&col_limit=1'
            )

        self.assertEqual(response.status_code, 200)
        reader.get_matrix.assert_called_once()
        args = reader.get_matrix.call_args[0]
        self.assertEqual(args[2], (1, 2))  # display_dims
        self.assertEqual(args[3], {0: 9})  # normalized fixed_indices

    def test_data_not_found_returns_404(self):
        reader = Mock()
        reader.get_dataset_info.side_effect = ValueError("Path '/missing' not found in 'sample.h5'")

        with patch('src.routes.hdf5.get_hdf5_reader', return_value=reader):
            response = self.client.get('/files/sample.h5/data?path=/missing&mode=line')

        self.assertEqual(response.status_code, 404)
        payload = response.get_json()
        self.assertFalse(payload['success'])

    def test_preview_invalid_display_dims_returns_400(self):
        reader = Mock()
        reader.get_dataset_info.return_value = {
            'shape': [10, 20, 30],
            'ndim': 3,
            'dtype': 'float32'
        }
        minio = Mock()
        minio.get_object_metadata.return_value = {'etag': 'etag-1'}

        with patch('src.routes.hdf5.get_hdf5_reader', return_value=reader), \
             patch('src.routes.hdf5.get_minio_client', return_value=minio), \
             patch('src.routes.hdf5.get_dataset_cache', return_value=_NullCache()), \
             patch('src.routes.hdf5.get_hdf5_cache', return_value=_NullCache()):
            response = self.client.get(
                '/files/sample.h5/preview?path=/array_3d&display_dims=1,1'
            )

        self.assertEqual(response.status_code, 400)
        payload = response.get_json()
        self.assertFalse(payload['success'])
        self.assertIn('display_dims', payload['error'])

    def test_preview_not_found_returns_404(self):
        reader = Mock()
        reader.get_dataset_info.side_effect = ValueError("Path '/missing' not found in 'sample.h5'")
        minio = Mock()
        minio.get_object_metadata.return_value = {'etag': 'etag-1'}

        with patch('src.routes.hdf5.get_hdf5_reader', return_value=reader), \
             patch('src.routes.hdf5.get_minio_client', return_value=minio), \
             patch('src.routes.hdf5.get_dataset_cache', return_value=_NullCache()), \
             patch('src.routes.hdf5.get_hdf5_cache', return_value=_NullCache()):
            response = self.client.get('/files/sample.h5/preview?path=/missing')

        self.assertEqual(response.status_code, 404)
        payload = response.get_json()
        self.assertFalse(payload['success'])


if __name__ == '__main__':
    unittest.main()
